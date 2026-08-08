import test from "node:test";
import assert from "node:assert/strict";
import worker, { api, expiredSessionCleanup, PASSWORD_POLICY, passwordHash } from "../worker/index.js";

test("만료 세션 청소 SQL은 시간 조건과 오래된 순서 및 100건 제한을 사용한다", async () => {
  let captured;
  const env={DB:{prepare(sql){return{bind(...args){captured={sql,args};return this;},async run(){return{meta:{changes:100}};}};}}};
  const result=await expiredSessionCleanup(env,new Date('2026-08-08T12:34:56.000Z'));
  assert.match(captured.sql,/^DELETE FROM sessions WHERE id IN \(SELECT id FROM sessions WHERE expires_at <= \? ORDER BY expires_at LIMIT 100\)$/);
  assert.deepEqual(captured.args,['2026-08-08 12:34:56']);
  assert.equal(result.meta.changes,100);
});

test("PBKDF2 정책은 Cloudflare 한도와 기존 형식에 맞는다", async () => {
  assert.equal(PASSWORD_POLICY.iterations, 100000);
  assert.equal(PASSWORD_POLICY.bits, 256);
  const salt = new Uint8Array(16).fill(7);
  const registered = await passwordHash("correct-password", salt);
  const loggedIn = await passwordHash("correct-password", salt);
  assert.equal(registered.hash, loggedIn.hash);
  assert.equal(registered.hash.length, 64);
  assert.equal(registered.salt.length, 32);
});

test("회원가입 해시로 로그인할 수 있다", async () => {
  const secured = await passwordHash("correct-password", new Uint8Array(16).fill(3));
  const env={DB:{prepare(sql){return{bind(){return this;},async first(){if(sql.includes("FROM users WHERE email="))return{id:"u",email:"seller@account.geno",name:"seller",role:"seller",password_hash:secured.hash,password_salt:secured.salt};throw new Error(sql);},async run(){if(sql.startsWith("DELETE FROM sessions")||sql.startsWith("INSERT INTO sessions"))return{meta:{changes:1}};throw new Error(sql);}};}}};
  const response=await api(new Request("https://example.com/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({accountName:"seller",password:"correct-password"})}),env,{waitUntil(){}});
  assert.equal(response.status,200);
  assert.equal(response.headers.get("cache-control"),"no-store");
  assert.match(response.headers.get("set-cookie"),/HttpOnly; Secure; SameSite=Lax/);
});

test("실제 회원가입 해시를 같은 설정으로 로그인하고 잘못된 비밀번호는 거부한다", async () => {
  let user;
  const env={DB:{prepare(sql){const statement={sql,args:[],bind(...args){this.args=args;return this;},async first(){if(sql==='SELECT id FROM users WHERE email=?')return user?{id:user.id}:null;if(sql.includes('FROM users WHERE email='))return user;throw new Error(sql);},async run(){if(sql.startsWith('DELETE FROM sessions')||sql.startsWith('INSERT INTO sessions'))return{meta:{changes:1}};throw new Error(sql);}};return statement;},async batch(statements){const values=statements[0].args;user={id:values[0],email:values[1],name:values[2],role:values[3],password_hash:values[4],password_salt:values[5]};return statements.map(()=>({meta:{changes:1}}));}}};
  const register=await api(new Request('https://example.com/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountName:'new-seller',password:'correct-password'})}),env,{waitUntil(){}});
  assert.equal(register.status,201);
  assert.equal(register.headers.get('cache-control'),'no-store');
  const login=await api(new Request('https://example.com/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountName:'new-seller',password:'correct-password'})}),env,{waitUntil(){}});
  assert.equal(login.status,200);
  const wrong=await api(new Request('https://example.com/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountName:'new-seller',password:'wrong-password'})}),env,{waitUntil(){}});
  assert.equal(wrong.status,401);
});

test("만료 세션은 인증되지 않는다", async () => {
  const env={DB:{prepare(sql){return{bind(){return this;},async first(){assert.match(sql,/expires_at > datetime/);return null;}};}}};
  const response=await api(new Request("https://example.com/api/me",{headers:{cookie:"session=expired"}}),env,{waitUntil(){}});
  assert.equal(response.status,401);
  assert.equal(response.headers.get('cache-control'),'no-store');
});

test("D1 미연결 health는 503이고 연결되면 최소 정보만 반환한다", async () => {
  const missing=await worker.fetch(new Request('https://example.com/api/health'),{},{});
  assert.equal(missing.status,503);
  assert.equal(missing.headers.get('cache-control'),'no-store');
  assert.equal((await missing.json()).code,'DB_BINDING_MISSING');
  const connected=await api(new Request('https://example.com/api/health'),{DB:{prepare(sql){assert.equal(sql,'SELECT 1 AS ok');return{async first(){return{ok:1};}};}}},{});
  const result=await connected.json();assert.equal(connected.status,200);assert.deepEqual(result,{ok:true,database:'ready',turnstile:'optional'});
  assert.equal(connected.headers.get('cache-control'),'no-store');
});

test("존재하지 않는 API는 인증 여부와 관계없이 404이고 보호 API는 401이다", async () => {
  const env={DB:{prepare(){throw new Error('unknown route must not query DB');}}};
  const missing=await api(new Request('https://example.com/api/not-a-route'),env,{});
  assert.equal(missing.status,404);
  assert.equal(missing.headers.get('cache-control'),'no-store');
  const protectedResponse=await api(new Request('https://example.com/api/project'),env,{});
  assert.equal(protectedResponse.status,401);
  assert.equal(protectedResponse.headers.get('cache-control'),'no-store');
});

test("JSON이 아닌 인증 요청과 손상된 JSON을 거부한다", async () => {
  const env={DB:{prepare(){throw new Error('invalid request must not query DB');}}};
  const plain=await worker.fetch(new Request('https://example.com/api/login',{method:'POST',headers:{'content-type':'text/plain'},body:'{}'}),env,{});
  assert.equal(plain.status,415);
  const malformed=await worker.fetch(new Request('https://example.com/api/login',{method:'POST',headers:{'content-type':'application/json'},body:'{'}),env,{});
  assert.equal(malformed.status,400);
});

test("로그아웃은 쿠키와 서버 세션을 지우고 no-store를 반환한다", async () => {
  const queries=[];
  const env={DB:{prepare(sql){queries.push(sql);return{bind(){return this;},async run(){return{meta:{changes:1}};}};}}};
  const response=await api(new Request('https://example.com/api/logout',{method:'POST',headers:{cookie:'session=local-session'}}),env,{});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
  assert.ok(queries.some(sql=>sql.startsWith('DELETE FROM sessions WHERE id=')));
  assert.equal(queries.filter(sql=>sql.startsWith('DELETE FROM sessions')).length,1);
});

test("인증 JSON 응답은 HTML 실행 문자를 이스케이프한다", async () => {
  const env={DB:{prepare(sql){return{bind(){return this;},async first(){if(sql.includes('FROM sessions JOIN users'))return{id:'seller-1',email:'seller@test.invalid',name:'<script>alert(1)</script>',role:'seller'};throw new Error(sql);}};}}};
  const response=await api(new Request('https://example.com/api/me',{headers:{cookie:'session=xss-session'}}),env,{});
  const raw=await response.text();
  assert.doesNotMatch(raw,/<script>/);
  assert.equal(JSON.parse(raw).user.name,'<script>alert(1)</script>');
});

test("로그인 요청 제한은 동일 주소의 반복 요청을 429로 차단한다", async () => {
  const ip=`test-${crypto.randomUUID()}`;
  const request=()=>new Request('https://example.com/api/login',{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':ip},body:JSON.stringify({accountName:'missing',password:'wrong-password'})});
  const env={DB:{prepare(sql){return{bind(){return this;},async first(){if(sql.includes('FROM users WHERE email='))return null;throw new Error(sql);}};}}};
  for(let i=0;i<12;i+=1)assert.equal((await api(request(),env,{})).status,401);
  assert.equal((await api(request(),env,{})).status,429);
});

test("Turnstile 필수 모드는 action과 hostname을 서버에서 검증한다", async () => {
  const originalFetch=globalThis.fetch;let dbTouched=false;
  globalThis.fetch=async()=>Response.json({success:true,action:'login',hostname:'example.com'});
  try {
    const env={TURNSTILE_REQUIRED:'true',TURNSTILE_SITE_KEY:'site',TURNSTILE_SECRET:'secret',TURNSTILE_HOSTNAMES:'example.com',DB:{prepare(){dbTouched=true;throw new Error('should not query for rejected action');}}};
    const response=await api(new Request('https://example.com/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountName:'seller',password:'password-123',turnstileToken:'valid-token'})}),env,{});
    assert.equal(response.status,403);assert.equal(dbTouched,false);
  } finally { globalThis.fetch=originalFetch; }
});

test("Turnstile 성공 토큰은 한 번 허용하고 재사용 실패는 거부한다", async () => {
  const secured=await passwordHash('correct-password',new Uint8Array(16).fill(9));
  const originalFetch=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>Response.json(calls++===0?{success:true,action:'login',hostname:'example.com'}:{success:false,'error-codes':['timeout-or-duplicate']});
  try {
    const env={TURNSTILE_REQUIRED:'true',TURNSTILE_SITE_KEY:'site',TURNSTILE_SECRET:'secret',TURNSTILE_HOSTNAMES:'example.com',DB:{prepare(sql){return{bind(){return this;},async first(){if(sql.includes('FROM users WHERE email='))return{id:'u',email:'seller@account.geno',name:'seller',role:'seller',password_hash:secured.hash,password_salt:secured.salt};throw new Error(sql);},async run(){if(sql.startsWith('DELETE FROM sessions')||sql.startsWith('INSERT INTO sessions'))return{meta:{changes:1}};throw new Error(sql);}};}}};
    const request=()=>new Request('https://example.com/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountName:'seller',password:'correct-password',turnstileToken:'single-use-token'})});
    assert.equal((await api(request(),env,{})).status,200);
    assert.equal((await api(request(),env,{})).status,403);
  } finally { globalThis.fetch=originalFetch; }
});
