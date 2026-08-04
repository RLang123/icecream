import { getMenuAvailability, normalizeProjectIngredientData, soldOutReason } from './menu-availability.js';

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control':'no-store', ...headers } });
const uid = () => crypto.randomUUID();
const makeSlug = () => `store-${crypto.randomUUID().slice(0, 8)}`;
export function orderNumber(value) {
  let hash = 2166136261;
  for (const character of String(value || '')) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return String(hash >>> 0).padStart(10, '0');
}
const enc = new TextEncoder();
const traffic = new Map();
export const PASSWORD_POLICY = Object.freeze({ algorithm: 'PBKDF2', hash: 'SHA-256', iterations: 100000, bits: 256, saltBytes: 16 });
const MAX_REQUEST_BYTES = 1_900_000;
const logError = (request, code) => console.error(JSON.stringify({ event:'GENO_API_ERROR', code, path:new URL(request.url).pathname, method:request.method, rayId:request.headers.get('cf-ray')||null }));

function throttle(request, scope, limit, windowMs) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'local';
  const key = `${scope}:${ip}`; const now = Date.now(); let entry = traffic.get(key);
  if (!entry || entry.reset <= now) entry = { count: 0, reset: now + windowMs };
  entry.count += 1; traffic.set(key, entry);
  if (traffic.size > 5000) for (const [k,v] of traffic) if (v.reset <= now) traffic.delete(k);
  return entry.count > limit ? Math.max(1, Math.ceil((entry.reset - now) / 1000)) : 0;
}
function guarded(request, scope, limit, windowMs) {
  const retry = throttle(request, scope, limit, windowMs);
  return retry ? json({ error:'요청이 일시적으로 많습니다. 잠시 후 다시 시도해 주세요.', emergency:true, retryAfter:retry },429,{'retry-after':String(retry),'cache-control':'no-store'}) : null;
}

function bytesToHex(bytes) { return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join(''); }
function hexToBytes(hex) {
  if (typeof hex !== 'string' || !/^[0-9a-f]+$/i.test(hex) || hex.length % 2) throw new Error('INVALID_PASSWORD_SALT');
  return new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)));
}
export async function passwordHash(password, salt = crypto.getRandomValues(new Uint8Array(PASSWORD_POLICY.saltBytes))) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: PASSWORD_POLICY.algorithm, salt, iterations: PASSWORD_POLICY.iterations, hash: PASSWORD_POLICY.hash }, key, PASSWORD_POLICY.bits);
  return { hash: bytesToHex(bits), salt: bytesToHex(salt) };
}
function constantTimeHexEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = enc.encode(left); const b = enc.encode(right); let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) difference |= (a[i % a.length] || 0) ^ (b[i % b.length] || 0);
  return difference === 0;
}
function cookies(request) { return Object.fromEntries((request.headers.get('cookie') || '').split(';').map(v => v.trim().split('=').map(decodeURIComponent)).filter(v => v.length === 2)); }
async function currentUser(request, env) {
  const sid = cookies(request).session;
  if (!sid) return null;
  return env.DB.prepare(`SELECT users.id, users.email, users.name, users.role FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.id=? AND sessions.expires_at > datetime('now')`).bind(sid).first();
}
function sellerAccount(input) {
  const raw = String(input.accountName || input.email || input.name || '').trim().normalize('NFKC');
  const legacyEmail = raw.includes('@');
  return {
    raw,
    email: legacyEmail ? raw.toLowerCase() : `${encodeURIComponent(raw.toLocaleLowerCase('ko-KR'))}@account.geno`,
    legacyEmail
  };
}
function publicUser(row) {
  const simpleAccount = String(row.email || '').endsWith('@account.geno');
  return {
    id: row.id,
    email: simpleAccount ? '' : row.email,
    accountName: simpleAccount ? row.name : row.email,
    name: row.name,
    role: row.role
  };
}
async function body(request, maxBytes = 100000) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) throw Object.assign(new Error('REQUEST_TOO_LARGE'), { status: 413, publicMessage: '요청 데이터가 너무 큽니다.' });
  if (!request.body) return {};
  const reader = request.body.getReader(); const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw Object.assign(new Error('REQUEST_TOO_LARGE'), { status: 413, publicMessage: '요청 데이터가 너무 큽니다.' }); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw Object.assign(new Error('INVALID_JSON'), { status: 400, publicMessage: 'JSON 요청 형식이 올바르지 않습니다.' }); }
}
const validId = value => (typeof value === 'string' || typeof value === 'number') && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(String(value));
const validText = (value, max, required = false) => typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
export function projectError(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !data.store || typeof data.store !== 'object' || Array.isArray(data.store) || !Array.isArray(data.categories) || !Array.isArray(data.items)) return '프로젝트의 매장, 카테고리, 메뉴 배열 형식이 올바르지 않습니다.';
  if (data.categories.length > 50) return '카테고리는 최대 50개까지 저장할 수 있습니다.';
  if (data.items.length > 500) return '메뉴는 최대 500개까지 저장할 수 있습니다.';
  if (!validText(data.store.name, 100, true)) return '매장 이름은 1~100자로 입력해 주세요.';
  if (data.store.tagline !== undefined && !validText(data.store.tagline, 300)) return '매장 소개는 300자 이하로 입력해 주세요.';
  if (data.store.departments !== undefined && (!Array.isArray(data.store.departments) || data.store.departments.length > 100 || data.store.departments.some(v => !validText(v, 50, true)))) return '부서 목록은 100개 이하, 각 이름은 1~50자로 입력해 주세요.';
  const categories = new Set();
  for (const category of data.categories) {
    if (!validText(category, 50, true)) return '카테고리 이름은 1~50자 문자열이어야 합니다.';
    if (categories.has(category)) return `카테고리 "${category}"가 중복되었습니다.`;
    categories.add(category);
  }
  if (data.store.ingredients !== undefined && !Array.isArray(data.store.ingredients)) return '재료 목록은 배열이어야 합니다.';
  if ((data.store.ingredients || []).length > 500) return '재료는 최대 500개까지 저장할 수 있습니다.';
  const ingredientIds = new Set();
  for (const ingredient of data.store.ingredients || []) {
    if (!ingredient || typeof ingredient !== 'object' || Array.isArray(ingredient)) return '각 재료는 객체 형식이어야 합니다.';
    const id = typeof ingredient.id === 'string' ? ingredient.id.trim() : '';
    const name = typeof ingredient?.name === 'string' ? ingredient.name.trim() : '';
    if (!validId(id)) return `재료 "${name || '(이름 없음)'}"의 식별자는 영문·숫자와 ._:-만 사용해 1~80자로 입력해 주세요.`;
    if (ingredientIds.has(id)) return `재료 식별자 "${id}"가 중복되었습니다.`;
    if (!name || name.length > 80) return `재료 "${id}"의 이름은 1~80자로 입력해 주세요.`;
    if (ingredient.available !== undefined && typeof ingredient.available !== 'boolean') return `재료 "${name}"의 판매 상태는 참/거짓이어야 합니다.`;
    ingredientIds.add(id);
  }
  const ids = new Set();
  for (const item of data.items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return '각 메뉴는 객체 형식이어야 합니다.';
    if (!validId(item.id)) return `메뉴 "${String(item.name || '(이름 없음)')}"의 식별자 형식이 올바르지 않습니다.`;
    if (ids.has(String(item.id))) return `메뉴 식별자 "${String(item.id)}"가 중복되었습니다.`;
    ids.add(String(item.id));
    if (!validText(item.name, 100, true)) return `메뉴 "${String(item.id)}"의 이름은 1~100자로 입력해 주세요.`;
    if (item.desc !== undefined && !validText(item.desc, 1000)) return `${item.name}의 설명은 1000자 이하로 입력해 주세요.`;
    if (!Number.isFinite(Number(item.price)) || Number(item.price) < 0 || Number(item.price) > 10000000) return `${item.name}의 가격은 0~10,000,000 사이여야 합니다.`;
    for (const key of ['smallPrice', 'largePrice']) if (item[key] !== undefined && (!Number.isFinite(Number(item[key])) || Number(item[key]) < 0 || Number(item[key]) > 10000000)) return `${item.name}의 사이즈 가격을 확인해 주세요.`;
    if (item.soldout !== undefined && typeof item.soldout !== 'boolean') return `${item.name}의 수동 품절 상태는 참/거짓이어야 합니다.`;
    if (item.ingredientIds !== undefined && !Array.isArray(item.ingredientIds)) return `${item.name}의 재료 연결은 배열이어야 합니다.`;
    const refs = new Set();
    for (const id of item.ingredientIds || []) {
      if (typeof id !== 'string') return `${item.name}의 재료 식별자는 문자열이어야 합니다.`;
      if (refs.has(id)) return `${item.name}에 재료 "${id}"가 중복 연결되었습니다.`;
      if (!ingredientIds.has(id)) return `${item.name}이 존재하지 않는 재료 "${id}"를 참조합니다.`;
      refs.add(id);
    }
    if (item.category !== undefined && (!validText(item.category, 50, true) || !categories.has(item.category))) return `${item.name}의 카테고리 "${String(item.category)}"가 카테고리 목록에 없습니다.`;
    if (item.image !== undefined && (!validText(item.image, 100000) || (item.image.startsWith('data:') && item.image.length > 70000))) return `${item.name}의 이미지가 너무 큽니다. 이미지를 다시 압축해 주세요.`;
  }
  if (enc.encode(JSON.stringify(data)).byteLength > 1800000) return '프로젝트가 1.8MB 저장 한도를 초과했습니다. 사진이나 불필요한 데이터를 줄여 주세요.';
  return null;
}
const sessionCookie = sid => `session=${encodeURIComponent(sid)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
const expiredSessionCleanup = env => env.DB.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
function turnstileState(env) {
  const requested = String(env.TURNSTILE_REQUIRED || '').toLowerCase() === 'true';
  const hostnames = String(env.TURNSTILE_HOSTNAMES || '').split(',').map(value => value.trim()).filter(Boolean);
  const configured = Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET && hostnames.length);
  return { requested, configured, required: requested && configured, hostnames };
}
async function verifyTurnstile(request, env, token, expectedAction) {
  const state = turnstileState(env);
  if (!state.required) return true;
  if (typeof token !== 'string' || token.length < 1 || token.length > 2048) return false;
  const params = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  const remoteIp = request.headers.get('cf-connecting-ip'); if (remoteIp) params.set('remoteip', remoteIp);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: params, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result?.success === true && result.action === expectedAction && state.hostnames.includes(result.hostname);
  } catch { return false; }
}
function originError(request) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return null;
  if (request.headers.get('sec-fetch-site') === 'cross-site') return '다른 사이트에서 보낸 요청은 허용되지 않습니다.';
  const origin = request.headers.get('origin');
  if (!origin) return null;
  try { return new URL(origin).origin === new URL(request.url).origin ? null : '요청 출처가 올바르지 않습니다.'; }
  catch { return '요청 출처가 올바르지 않습니다.'; }
}

export async function api(request, env, ctx) {
  const url = new URL(request.url); const path = url.pathname; const method = request.method;
  const globalBlock=guarded(request,'all',1000,10000);if(globalBlock)return globalBlock;
  const invalidOrigin=originError(request);if(invalidOrigin)return json({error:invalidOrigin,code:'ORIGIN_REJECTED'},403,{'cache-control':'no-store'});
  if (path === '/api/health' && method === 'GET') {
    try { const result=await env.DB.prepare('SELECT 1 AS ok').first();if(result?.ok!==1)return json({ok:false,code:'HEALTH_DB_FAILED'},503,{'cache-control':'no-store'});const turnstile=turnstileState(env);return json({ok:true,database:'ready',turnstile:turnstile.required?'required':turnstile.requested?'configuration-incomplete':'optional'},200,{'cache-control':'no-store'}); }
    catch { logError(request,'HEALTH_DB_FAILED');return json({ok:false,code:'HEALTH_DB_FAILED'},503,{'cache-control':'no-store'}); }
  }
  if (path === '/api/auth-config' && method === 'GET') { const state=turnstileState(env);return json({turnstile:{enabled:state.required,siteKey:state.required?env.TURNSTILE_SITE_KEY:''}},200,{'cache-control':'no-store'}); }
  if (path === '/api/register' && method === 'POST') {
    const blocked=guarded(request,'register',5,300000);if(blocked)return blocked;
    const input = await body(request); const account = sellerAccount(input); const email = account.email;
    if(!await verifyTurnstile(request,env,input.turnstileToken,'register'))return json({error:'사람인지 확인하지 못했습니다. 확인 상자를 다시 완료해 주세요.',code:'TURNSTILE_REJECTED'},403);
    if ((!account.legacyEmail && (account.raw.length < 2 || account.raw.length > 30)) || (account.legacyEmail && !/^\S+@\S+\.\S+$/.test(account.raw)) || String(input.password || '').length < 8) return json({ error: '계정 이름은 2~30자, 비밀번호는 8자 이상 입력해 주세요.' }, 400);
    const exists = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first(); if (exists) return json({ error: '이미 사용 중인 계정 이름입니다.' }, 409);
    const id = uid(); const secured = await passwordHash(input.password); const sid = uid();
    const name = String(input.name || account.raw || '판매자').trim().slice(0,40);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users(id,email,name,role,password_hash,password_salt) VALUES(?,?,?,?,?,?)').bind(id,email,name,'seller',secured.hash,secured.salt),
      env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,datetime('now','+30 days'))").bind(sid,id)
    ]);
    return json({ user:publicUser({ id,email,name,role:'seller' }) }, 201, { 'set-cookie': sessionCookie(sid) });
  }
  if (path === '/api/login' && method === 'POST') {
    const blocked=guarded(request,'login',12,300000);if(blocked)return blocked;
    const input = await body(request); const account = sellerAccount(input);
    if(!await verifyTurnstile(request,env,input.turnstileToken,'login'))return json({error:'사람인지 확인하지 못했습니다. 확인 상자를 다시 완료해 주세요.',code:'TURNSTILE_REJECTED'},403);
    await expiredSessionCleanup(env);
    const row = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(account.email).first();
    if (!row) return json({ error:'계정 이름 또는 비밀번호가 올바르지 않습니다.' },401);
    if (row.role !== 'seller') return json({ error:'판매자 계정으로만 로그인할 수 있습니다.' },403);
    const secured = await passwordHash(String(input.password||''),hexToBytes(row.password_salt));
    if (!constantTimeHexEqual(secured.hash,row.password_hash)) return json({ error:'계정 이름 또는 비밀번호가 올바르지 않습니다.' },401);
    const sid=uid(); await env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,datetime('now','+30 days'))").bind(sid,row.id).run();
    return json({user:publicUser(row)},200,{'set-cookie':sessionCookie(sid)});
  }
  if (path === '/api/logout' && method === 'POST') { const sid=cookies(request).session; if(sid) await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(sid).run();await expiredSessionCleanup(env);return json({ok:true},200,{'set-cookie':'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}); }
  if(path.startsWith('/api/store/') && method==='GET') { const slug=decodeURIComponent(path.split('/').pop()); if(!/^store-[a-z0-9-]{8,40}$/.test(slug))return json({error:'잘못된 매장 주소입니다.'},400);const blocked=guarded(request,'store',600,60000);if(blocked)return blocked;const project=await env.DB.prepare('SELECT data,slug,updated_at FROM projects WHERE slug=?').bind(slug).first(); if(!project)return json({error:'존재하지 않거나 아직 내보내지 않은 매장입니다.'},404); try{return json({data:normalizeProjectIngredientData(JSON.parse(project.data)),slug:project.slug},200,{'cache-control':'public, max-age=5, s-maxage=5, must-revalidate'})}catch{return json({error:'매장 데이터를 불러올 수 없습니다.'},500)} }
  if(path==='/api/orders' && method==='POST') {
    const blocked=guarded(request,'order',60,60000);if(blocked)return blocked;
    const input=await body(request); const project=await env.DB.prepare('SELECT owner_id,data FROM projects WHERE slug=?').bind(String(input.storeSlug||'')).first();
    if(!project)return json({error:'주문 가능한 매장이 없습니다.'},404);
    let storeData;try{storeData=normalizeProjectIngredientData(JSON.parse(project.data))}catch{return json({error:'매장 메뉴 데이터가 손상되었습니다.'},500)}const menu=storeData.items||[];const requested=Array.isArray(input.items)?input.items:[];
    if(!requested.length||requested.length>30)return json({error:'주문 상품을 확인해 주세요.'},400);
    const safeItems=[];let total=0;for(const line of requested){const product=menu.find(i=>String(i.id)===String(line.id));const qty=Math.floor(Number(line.qty));if(!product)return json({error:'현재 판매하지 않는 메뉴가 주문에 포함되어 있습니다.'},400);const availability=getMenuAvailability(product,storeData.store);if(availability.soldOut)return json({error:`${product.name} 메뉴는 주문할 수 없습니다. ${soldOutReason(availability)}`},409);if(qty<1||qty>20)return json({error:'상품 수량을 확인해 주세요.'},400);const mode=product.temperatureMode||'both';let temperature=String(line.temperature||'');if(mode==='hot')temperature='HOT';if(mode==='ice')temperature='ICE';if(mode==='none')temperature='NONE';if(mode==='both'&&!['HOT','ICE'].includes(temperature))return json({error:`${product.name}의 온도를 선택해 주세요.`},400);const sizes=product.sizesEnabled!==false;const size=sizes&&(line.size==='S'?'S':'L');const base=sizes?Number(size==='S'?(product.smallPrice??product.price):(product.largePrice??product.price)):Number(product.price);let shots=Math.floor(Number(line.shots||0));if(shots<0||shots>100)return json({error:'샷 횟수를 확인해 주세요.'},400);const shotAllowed=!!product.shotsEnabled&&temperature!=='NONE'&&(temperature==='HOT'?product.hotShots!==false:temperature==='ICE'?product.iceShots!==false:false);if(!shotAllowed)shots=0;const shotPrice=Math.max(0,Math.round(Number(storeData.store?.shotPrice??500)));const price=Math.max(0,Math.round(base))+shots*shotPrice;if(!Number.isFinite(price))return json({error:'상품 가격이 올바르지 않습니다.'},400);safeItems.push({id:product.id,name:String(product.name).slice(0,80),emoji:String(product.emoji||'').slice(0,8),temperature,size:sizes?size:'NONE',shots,shotPrice,price,qty});total+=price*qty;}
    const departments=Array.isArray(storeData.store?.departments)?storeData.store.departments.filter(Boolean):[];const department=String(input.department||'').trim().slice(0,50);if(departments.length&&!departments.includes(department))return json({error:'부서를 선택해 주세요.'},400);if(total<=0||total>10000000)return json({error:'주문 금액을 확인해 주세요.'},400);const diningType=input.diningType==='포장'?'포장':'매장';const customerName=String(input.customerName||'현장 고객').trim().slice(0,30)||'현장 고객';const requestKey=String(input.requestKey||'').trim();if(!/^[a-zA-Z0-9-]{16,80}$/.test(requestKey))return json({error:'주문 요청 번호가 올바르지 않습니다.'},400);const previous=await env.DB.prepare('SELECT id,total FROM orders WHERE seller_id=? AND request_key=?').bind(project.owner_id,requestKey).first();if(previous)return json({id:previous.id,number:orderNumber(previous.id),total:previous.total,deduplicated:true},200);const id=uid();
    const inserted=await env.DB.prepare('INSERT OR IGNORE INTO orders(id,seller_id,customer_id,customer_name,items,total,dining_type,department,request_key) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,project.owner_id,null,customerName,JSON.stringify(safeItems),total,diningType,department||null,requestKey).run();if(!inserted.meta.changes){const existing=await env.DB.prepare('SELECT id,total FROM orders WHERE seller_id=? AND request_key=?').bind(project.owner_id,requestKey).first();if(existing)return json({id:existing.id,number:orderNumber(existing.id),total:existing.total,deduplicated:true},200);return json({error:'주문 접수가 충돌했습니다. 다시 시도해 주세요.'},409)}return json({id,number:orderNumber(id),total},201);
  }
  const protectedRoute = (path==='/api/me' && method==='GET') || (path==='/api/project' && ['GET','PUT'].includes(method)) || (path==='/api/export' && method==='POST') || (path==='/api/orders' && method==='GET') || (path==='/api/my-orders' && method==='GET') || (['PATCH','DELETE'].includes(method) && /^\/api\/orders\/[^/]+$/.test(path));
  if(!protectedRoute)return json({error:'찾을 수 없습니다.'},404);
  const user = await currentUser(request,env); if(!user) return json({error:'로그인이 필요합니다.'},401);
  if(path==='/api/me' && method==='GET') {if(user.role!=='seller')return json({error:'판매자 로그인이 필요합니다.'},403);return json({user:publicUser(user)});}
  if(path==='/api/project' && method==='GET') { if(user.role!=='seller')return json({error:'권한이 없습니다.'},403); const p=await env.DB.prepare('SELECT data,slug FROM projects WHERE owner_id=?').bind(user.id).first();if(!p)return json({data:null,slug:null});try{return json({data:normalizeProjectIngredientData(JSON.parse(p.data)),slug:p.slug||null})}catch{return json({error:'저장된 프로젝트를 읽을 수 없습니다.'},500)} }
  if(path==='/api/project' && method==='PUT') { if(user.role!=='seller')return json({error:'권한이 없습니다.'},403); const input=await body(request,MAX_REQUEST_BYTES);const invalid=projectError(input.data);if(invalid)return json({error:invalid},400);const data=normalizeProjectIngredientData(input.data);const existing=await env.DB.prepare('SELECT slug FROM projects WHERE owner_id=?').bind(user.id).first(); const slug=existing?.slug||makeSlug(); await env.DB.prepare(`INSERT INTO projects(owner_id,data,slug,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(owner_id) DO UPDATE SET data=excluded.data,updated_at=CURRENT_TIMESTAMP`).bind(user.id,JSON.stringify(data),slug).run(); return json({ok:true,slug}); }
  if(path==='/api/export' && method==='POST') { if(user.role!=='seller')return json({error:'권한이 없습니다.'},403); let project=await env.DB.prepare('SELECT slug FROM projects WHERE owner_id=?').bind(user.id).first(); if(!project)return json({error:'먼저 매장을 한 번 저장해 주세요.'},400); if(!project.slug){const slug=makeSlug();await env.DB.prepare('UPDATE projects SET slug=? WHERE owner_id=?').bind(slug,user.id).run();project={slug}} return json({slug:project.slug}); }
  if(path==='/api/orders' && method==='GET') { if(user.role!=='seller')return json({error:'권한이 없습니다.'},403);const blocked=guarded(request,'seller-orders',40,60000);if(blocked)return blocked;const result=await env.DB.prepare('SELECT orders.*, (SELECT COUNT(*) FROM payment_attempts WHERE payment_attempts.order_id=orders.id) AS payment_attempt_count FROM orders WHERE seller_id=? ORDER BY created_at DESC LIMIT 150').bind(user.id).all(); return json({orders:result.results.map(o=>{try{return {...o,number:orderNumber(o.id),items:JSON.parse(o.items)}}catch{return {...o,number:orderNumber(o.id),items:[]}}})}); }
  if(path==='/api/my-orders' && method==='GET') { if(user.role!=='customer')return json({error:'권한이 없습니다.'},403); const result=await env.DB.prepare('SELECT id,items,total,dining_type,status,created_at FROM orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 20').bind(user.id).all(); return json({orders:result.results.map(o=>({...o,items:JSON.parse(o.items)}))}); }
  if(path.startsWith('/api/orders/') && method==='DELETE') {
    if(user.role!=='seller')return json({error:'권한이 없습니다.'},403);const id=path.split('/').pop();const result=await env.DB.prepare("DELETE FROM orders WHERE id=? AND seller_id=? AND status IN ('cancelled','refunded')").bind(id,user.id).run();if(!result.meta.changes)return json({error:'취소 또는 환불된 주문만 삭제할 수 있습니다.'},409);return json({ok:true});
  }
  if(path.startsWith('/api/orders/') && method==='PATCH') {
    if(user.role!=='seller')return json({error:'권한이 없습니다.'},403);const input=await body(request);const id=path.split('/').pop();const order=await env.DB.prepare('SELECT status,items FROM orders WHERE id=? AND seller_id=?').bind(id,user.id).first();if(!order)return json({error:'주문을 찾을 수 없습니다.'},404);
    if(input.status==='completed'){
      if(!['cash','prepaid','transfer','coupon'].includes(input.paymentMethod))return json({error:'결제수단을 선택해 주세요.'},400);if(!['new','preparing'].includes(order.status)){await env.DB.prepare('INSERT INTO payment_attempts(id,order_id,seller_id,payment_method,outcome,message) VALUES(?,?,?,?,?,?)').bind(uid(),id,user.id,input.paymentMethod,'rejected','이미 처리된 주문').run();return json({error:'이미 완료되었거나 처리할 수 없는 주문입니다.'},409)}let items;try{items=JSON.parse(order.items)}catch{return json({error:'주문 데이터가 손상되었습니다.'},500)}const total=items.reduce((sum,item)=>sum+Number(item.price)*Number(item.qty),0);const result=await env.DB.prepare("UPDATE orders SET status='completed',payment_method=?,completed_at=CURRENT_TIMESTAMP,total=? WHERE id=? AND seller_id=? AND status IN ('new','preparing')").bind(input.paymentMethod,total,id,user.id).run();if(!result.meta.changes){await env.DB.prepare('INSERT INTO payment_attempts(id,order_id,seller_id,payment_method,outcome,message) VALUES(?,?,?,?,?,?)').bind(uid(),id,user.id,input.paymentMethod,'rejected','중복 완료 요청').run();return json({error:'다른 요청에서 이미 처리된 주문입니다.'},409)}await env.DB.prepare('INSERT INTO payment_attempts(id,order_id,seller_id,payment_method,outcome,message) VALUES(?,?,?,?,?,?)').bind(uid(),id,user.id,input.paymentMethod,'success','판매완료').run();return json({ok:true,total});
    }
    if(input.status==='refunded'){const reason=String(input.reason||'판매자 환불 처리').trim().slice(0,200);const result=await env.DB.prepare("UPDATE orders SET status='refunded',refunded_at=CURRENT_TIMESTAMP,refund_reason=? WHERE id=? AND seller_id=? AND status IN ('completed','done')").bind(reason,id,user.id).run();if(!result.meta.changes)return json({error:'판매완료된 주문만 환불할 수 있습니다.'},409);return json({ok:true});}
    if(input.status==='preparing'){const result=await env.DB.prepare("UPDATE orders SET status='preparing' WHERE id=? AND seller_id=? AND status='new'").bind(id,user.id).run();if(!result.meta.changes)return json({error:'대기 중인 주문만 준비를 시작할 수 있습니다.'},409);return json({ok:true});}
    if(input.status==='cancelled'){const result=await env.DB.prepare("UPDATE orders SET status='cancelled' WHERE id=? AND seller_id=? AND status IN ('new','preparing')").bind(id,user.id).run();if(!result.meta.changes)return json({error:'대기 또는 준비 중인 주문만 취소할 수 있습니다.'},409);return json({ok:true});}
    return json({error:'잘못된 상태입니다.'},400);
  }
  return json({error:'찾을 수 없습니다.'},404);
}

export default { async fetch(request,env,ctx) { const url=new URL(request.url); if(url.pathname.startsWith('/api/')){if(!env.DB)return json({error:'Cloudflare에 D1 데이터베이스가 연결되지 않았습니다. DB 바인딩을 확인해 주세요.',code:'DB_BINDING_MISSING'},503);try{return await api(request,env,ctx)}catch(error){const status=Number(error?.status);if(status>=400&&status<500)return json({error:error.publicMessage||'요청을 처리할 수 없습니다.',code:error.message},status,{'cache-control':'no-store'});logError(request,'DATABASE_NOT_READY');return json({error:'서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',code:'DATABASE_NOT_READY'},503,{'cache-control':'no-store'})}} const asset=await env.ASSETS.fetch(request);const response=new Response(asset.body,asset);response.headers.set('x-content-type-options','nosniff');response.headers.set('referrer-policy','strict-origin-when-cross-origin');response.headers.set('x-frame-options','SAMEORIGIN');response.headers.set('permissions-policy','camera=(), microphone=(), geolocation=()');return response; } };
