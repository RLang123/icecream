const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
const uid = () => crypto.randomUUID();
const makeSlug = () => `store-${crypto.randomUUID().slice(0, 8)}`;
const enc = new TextEncoder();
const traffic = new Map();

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
function hexToBytes(hex) { return new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16))); }
async function passwordHash(password, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, key, 256);
  return { hash: bytesToHex(bits), salt: bytesToHex(salt) };
}
function cookies(request) { return Object.fromEntries((request.headers.get('cookie') || '').split(';').map(v => v.trim().split('=').map(decodeURIComponent)).filter(v => v.length === 2)); }
async function currentUser(request, env) {
  const sid = cookies(request).session;
  if (!sid) return null;
  return env.DB.prepare(`SELECT users.id, users.email, users.name, users.role FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.id=? AND sessions.expires_at > datetime('now')`).bind(sid).first();
}
async function body(request) { try { return await request.json(); } catch { return {}; } }
function projectError(data){if(!data||typeof data!=='object'||!data.store||!Array.isArray(data.categories)||!Array.isArray(data.items))return '프로젝트 형식이 올바르지 않습니다.';if(data.categories.length>50||data.items.length>500)return '카테고리 또는 메뉴가 너무 많습니다.';if(!String(data.store.name||'').trim())return '매장 이름을 입력해 주세요.';const ids=new Set();for(const item of data.items){if(item.id===undefined||ids.has(String(item.id)))return '메뉴 식별자가 중복되거나 없습니다.';ids.add(String(item.id));if(!String(item.name||'').trim()||!Number.isFinite(Number(item.price))||Number(item.price)<0||Number(item.price)>10000000)return '메뉴 이름과 가격을 확인해 주세요.';}if(JSON.stringify(data).length>2500000)return '사진이 너무 많아 프로젝트 저장 용량을 초과했습니다. 일부 사진을 제거해 주세요.';return null;}
const sessionCookie = sid => `session=${encodeURIComponent(sid)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
async function clearExpiredOrders(env){await env.DB.prepare("DELETE FROM orders WHERE date(created_at, '+9 hours') < date('now', '+9 hours')").run();}

async function api(request, env, ctx) {
  const url = new URL(request.url); const path = url.pathname; const method = request.method;
  const globalBlock=guarded(request,'all',1000,10000);if(globalBlock)return globalBlock;
  if (path === '/api/register' && method === 'POST') {
    const blocked=guarded(request,'register',5,300000);if(blocked)return blocked;
    const input = await body(request); const email = String(input.email || '').trim().toLowerCase();
    if (!email.includes('@') || String(input.password || '').length < 8) return json({ error: '입력 정보를 확인해 주세요. 비밀번호는 8자 이상이어야 합니다.' }, 400);
    const exists = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first(); if (exists) return json({ error: '이미 가입된 이메일입니다.' }, 409);
    const id = uid(); const secured = await passwordHash(input.password); const sid = uid();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users(id,email,name,role,password_hash,password_salt) VALUES(?,?,?,?,?,?)').bind(id,email,String(input.name||'판매자').slice(0,40),'seller',secured.hash,secured.salt),
      env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,datetime('now','+30 days'))").bind(sid,id)
    ]);
    return json({ user:{ id,email,name:input.name,role:'seller' } }, 201, { 'set-cookie': sessionCookie(sid) });
  }
  if (path === '/api/login' && method === 'POST') {
    const blocked=guarded(request,'login',12,300000);if(blocked)return blocked;
    const input = await body(request); const row = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(String(input.email||'').trim().toLowerCase()).first();
    if (!row) return json({ error:'이메일 또는 비밀번호가 올바르지 않습니다.' },401);
    if (row.role !== 'seller') return json({ error:'판매자 계정으로만 로그인할 수 있습니다.' },403);
    const secured = await passwordHash(String(input.password||''),hexToBytes(row.password_salt));
    if (secured.hash !== row.password_hash) return json({ error:'이메일 또는 비밀번호가 올바르지 않습니다.' },401);
    const sid=uid(); await env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,datetime('now','+30 days'))").bind(sid,row.id).run();
    return json({user:{id:row.id,email:row.email,name:row.name,role:row.role}},200,{'set-cookie':sessionCookie(sid)});
  }
  if (path === '/api/logout' && method === 'POST') { const sid=cookies(request).session; if(sid) await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(sid).run(); return json({ok:true},200,{'set-cookie':'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}); }
  if(path.startsWith('/api/store/') && method==='GET') { const slug=decodeURIComponent(path.split('/').pop()); if(!/^store-[a-z0-9-]{8,40}$/.test(slug))return json({error:'잘못된 매장 주소입니다.'},400);const cache=caches.default;const cacheKey=new Request(url.toString(),{method:'GET'});const cached=await cache.match(cacheKey);if(cached)return cached;const blocked=guarded(request,'store',600,60000);if(blocked)return blocked;const project=await env.DB.prepare('SELECT data,slug,updated_at FROM projects WHERE slug=?').bind(slug).first(); if(!project)return json({error:'존재하지 않거나 아직 내보내지 않은 매장입니다.'},404); try{const response=json({data:JSON.parse(project.data),slug:project.slug},200,{'cache-control':'public, max-age=15, stale-while-revalidate=60','x-geno-cache':'miss'});ctx.waitUntil(cache.put(cacheKey,response.clone()));return response}catch{return json({error:'매장 데이터를 불러올 수 없습니다.'},500)} }
  if(path==='/api/orders' && method==='POST') {
    const blocked=guarded(request,'order',60,60000);if(blocked)return blocked;
    const contentLength=Number(request.headers.get('content-length')||0);if(contentLength>100000)return json({error:'주문 데이터가 너무 큽니다.'},413);
    await clearExpiredOrders(env);
    const input=await body(request); const project=await env.DB.prepare('SELECT owner_id,data FROM projects WHERE slug=?').bind(String(input.storeSlug||'')).first();
    if(!project)return json({error:'주문 가능한 매장이 없습니다.'},404);
    let storeData;try{storeData=JSON.parse(project.data)}catch{return json({error:'매장 메뉴 데이터가 손상되었습니다.'},500)}const menu=storeData.items||[];const requested=Array.isArray(input.items)?input.items:[];
    if(!requested.length||requested.length>30)return json({error:'주문 상품을 확인해 주세요.'},400);
    const safeItems=[];let total=0;for(const line of requested){const product=menu.find(i=>String(i.id)===String(line.id));const qty=Math.floor(Number(line.qty));const ingredientSoldOut=(product?.ingredientIds||[]).some(id=>(storeData.store?.ingredients||[]).find(ingredient=>ingredient.id===id)?.available===false);if(!product||product.soldout||ingredientSoldOut||qty<1||qty>20)return json({error:'판매할 수 없는 상품이 포함되어 있습니다.'},400);const mode=product.temperatureMode||'both';let temperature=String(line.temperature||'');if(mode==='hot')temperature='HOT';if(mode==='ice')temperature='ICE';if(mode==='none')temperature='NONE';if(mode==='both'&&!['HOT','ICE'].includes(temperature))return json({error:`${product.name}의 온도를 선택해 주세요.`},400);const sizes=product.sizesEnabled!==false;const size=sizes&&(line.size==='S'?'S':'L');const base=sizes?Number(size==='S'?(product.smallPrice??product.price):(product.largePrice??product.price)):Number(product.price);let shots=Math.floor(Number(line.shots||0));if(shots<0||shots>100)return json({error:'샷 횟수를 확인해 주세요.'},400);const shotAllowed=!!product.shotsEnabled&&temperature!=='NONE'&&(temperature==='HOT'?product.hotShots!==false:temperature==='ICE'?product.iceShots!==false:false);if(!shotAllowed)shots=0;const shotPrice=Math.max(0,Math.round(Number(storeData.store?.shotPrice??500)));const price=Math.max(0,Math.round(base))+shots*shotPrice;if(!Number.isFinite(price))return json({error:'상품 가격이 올바르지 않습니다.'},400);safeItems.push({id:product.id,name:String(product.name).slice(0,80),emoji:String(product.emoji||'').slice(0,8),temperature,size:sizes?size:'NONE',shots,shotPrice,price,qty});total+=price*qty;}
    const departments=Array.isArray(storeData.store?.departments)?storeData.store.departments.filter(Boolean):[];const department=String(input.department||'').trim().slice(0,50);if(departments.length&&!departments.includes(department))return json({error:'부서를 선택해 주세요.'},400);if(total<=0||total>10000000)return json({error:'주문 금액을 확인해 주세요.'},400);const diningType=input.diningType==='포장'?'포장':'매장';const customerName=String(input.customerName||'현장 고객').trim().slice(0,30)||'현장 고객';const requestKey=String(input.requestKey||'').trim();if(!/^[a-zA-Z0-9-]{16,80}$/.test(requestKey))return json({error:'주문 요청 번호가 올바르지 않습니다.'},400);const previous=await env.DB.prepare('SELECT id,total FROM orders WHERE seller_id=? AND request_key=?').bind(project.owner_id,requestKey).first();if(previous)return json({id:previous.id,number:previous.id.slice(0,4).toUpperCase(),total:previous.total,deduplicated:true},200);const id=uid();
    const inserted=await env.DB.prepare('INSERT OR IGNORE INTO orders(id,seller_id,customer_id,customer_name,items,total,dining_type,department,request_key) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,project.owner_id,null,customerName,JSON.stringify(safeItems),total,diningType,department||null,requestKey).run();if(!inserted.meta.changes){const existing=await env.DB.prepare('SELECT id,total FROM orders WHERE seller_id=? AND request_key=?').bind(project.owner_id,requestKey).first();if(existing)return json({id:existing.id,number:existing.id.slice(0,4).toUpperCase(),total:existing.total,deduplicated:true},200);return json({error:'주문 접수가 충돌했습니다. 다시 시도해 주세요.'},409)}return json({id,number:id.slice(0,4).toUpperCase(),total},201);
  }
  const user = await currentUser(request,env); if(!user) return json({error:'로그인이 필요합니다.'},401);
  if(path==='/api/me') {if(user.role!=='seller')return json({error:'판매자 로그인이 필요합니다.'},403);return json({user});}
  if(path==='/api/project' && method==='GET') { if(user.role!=='seller')return json({error:'권한이 없습니다.'},403); const p=await env.DB.prepare('SELECT data,slug FROM projects WHERE owner_id=?').bind(user.id).first();if(!p)return json({data:null,slug:null});try{return json({data:JSON.parse(p.data),slug:p.slug||null})}catch{return json({error:'저장된 프로젝트를 읽을 수 없습니다.'},500)} }
  if(path==='/api/project' && method==='PUT') { if(user.role!=='seller')return json({error:'권한이 없습니다.'},403); const input=await body(request);const invalid=projectError(input.data);if(invalid)return json({error:invalid},400);const existing=await env.DB.prepare('SELECT slug FROM projects WHERE owner_id=?').bind(user.id).first(); const slug=existing?.slug||makeSlug(); await env.DB.prepare(`INSERT INTO projects(owner_id,data,slug,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(owner_id) DO UPDATE SET data=excluded.data,updated_at=CURRENT_TIMESTAMP`).bind(user.id,JSON.stringify(input.data),slug).run();ctx.waitUntil(caches.default.delete(new Request(`${url.origin}/api/store/${slug}`))); return json({ok:true,slug}); }
  if(path==='/api/export' && method==='POST') { if(user.role!=='seller')return json({error:'권한이 없습니다.'},403); let project=await env.DB.prepare('SELECT slug FROM projects WHERE owner_id=?').bind(user.id).first(); if(!project)return json({error:'먼저 매장을 한 번 저장해 주세요.'},400); if(!project.slug){const slug=makeSlug();await env.DB.prepare('UPDATE projects SET slug=? WHERE owner_id=?').bind(slug,user.id).run();project={slug}} return json({slug:project.slug}); }
  if(path==='/api/orders' && method==='GET') { if(user.role!=='seller')return json({error:'권한이 없습니다.'},403);const blocked=guarded(request,'seller-orders',40,60000);if(blocked)return blocked;const result=await env.DB.prepare('SELECT orders.*, (SELECT COUNT(*) FROM payment_attempts WHERE payment_attempts.order_id=orders.id) AS payment_attempt_count FROM orders WHERE seller_id=? ORDER BY created_at DESC LIMIT 150').bind(user.id).all(); return json({orders:result.results.map(o=>{try{return {...o,items:JSON.parse(o.items)}}catch{return {...o,items:[]}}})}); }
  if(path==='/api/my-orders' && method==='GET') { if(user.role!=='customer')return json({error:'권한이 없습니다.'},403); const result=await env.DB.prepare('SELECT id,items,total,dining_type,status,created_at FROM orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 20').bind(user.id).all(); return json({orders:result.results.map(o=>({...o,items:JSON.parse(o.items)}))}); }
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

export default { async fetch(request,env,ctx) { const url=new URL(request.url); if(url.pathname.startsWith('/api/')){if(!env.DB)return json({error:'Cloudflare Pages에 D1 데이터베이스가 연결되지 않았습니다. DB 바인딩을 확인해 주세요.',code:'DB_BINDING_MISSING'},503);try{return await api(request,env,ctx)}catch(error){console.error('GENO API error',error);return json({error:'데이터베이스가 준비되지 않았습니다. D1 연결과 테이블 설치를 확인해 주세요.',code:'DATABASE_NOT_READY'},503)}} const asset=await env.ASSETS.fetch(request);const response=new Response(asset.body,asset);response.headers.set('x-content-type-options','nosniff');response.headers.set('referrer-policy','strict-origin-when-cross-origin');response.headers.set('x-frame-options','SAMEORIGIN');response.headers.set('permissions-policy','camera=(), microphone=(), geolocation=()');return response; },async scheduled(_controller,env,ctx){ctx.waitUntil(clearExpiredOrders(env));} };
