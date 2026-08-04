import test from "node:test";
import assert from "node:assert/strict";
import worker, { api, PASSWORD_POLICY, passwordHash } from "../worker/index.js";

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
  const env={DB:{prepare(sql){return{bind(){return this;},async first(){if(sql.startsWith("SELECT * FROM users"))return{id:"u",email:"seller@account.geno",name:"seller",role:"seller",password_hash:secured.hash,password_salt:secured.salt};throw new Error(sql);},async run(){if(sql.startsWith("DELETE FROM sessions")||sql.startsWith("INSERT INTO sessions"))return{meta:{changes:1}};throw new Error(sql);}};}}};
  const response=await api(new Request("https://example.com/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({accountName:"seller",password:"correct-password"})}),env,{waitUntil(){}});
  assert.equal(response.status,200);
  assert.match(response.headers.get("set-cookie"),/HttpOnly; Secure; SameSite=Lax/);
});

test("실제 회원가입 해시를 같은 설정으로 로그인하고 잘못된 비밀번호는 거부한다", async () => {
  let user;
  const env={DB:{prepare(sql){const statement={sql,args:[],bind(...args){this.args=args;return this;},async first(){if(sql==='SELECT id FROM users WHERE email=?')return user?{id:user.id}:null;if(sql.startsWith('SELECT * FROM users'))return user;throw new Error(sql);},async run(){if(sql.startsWith('DELETE FROM sessions')||sql.startsWith('INSERT INTO sessions'))return{meta:{changes:1}};throw new Error(sql);}};return statement;},async batch(statements){const values=statements[0].args;user={id:values[0],email:values[1],name:values[2],role:values[3],password_hash:values[4],password_salt:values[5]};return statements.map(()=>({meta:{changes:1}}));}}};
  const register=await api(new Request('https://example.com/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountName:'new-seller',password:'correct-password'})}),env,{waitUntil(){}});
  assert.equal(register.status,201);
  const login=await api(new Request('https://example.com/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountName:'new-seller',password:'correct-password'})}),env,{waitUntil(){}});
  assert.equal(login.status,200);
  const wrong=await api(new Request('https://example.com/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountName:'new-seller',password:'wrong-password'})}),env,{waitUntil(){}});
  assert.equal(wrong.status,401);
});

test("만료 세션은 인증되지 않는다", async () => {
  const env={DB:{prepare(sql){return{bind(){return this;},async first(){assert.match(sql,/expires_at > datetime/);return null;}};}}};
  const response=await api(new Request("https://example.com/api/me",{headers:{cookie:"session=expired"}}),env,{waitUntil(){}});
  assert.equal(response.status,401);
});

test("D1 미연결 health는 503이고 연결되면 최소 정보만 반환한다", async () => {
  const missing=await worker.fetch(new Request('https://example.com/api/health'),{},{});
  assert.equal(missing.status,503);
  assert.equal((await missing.json()).code,'DB_BINDING_MISSING');
  const connected=await api(new Request('https://example.com/api/health'),{DB:{prepare(sql){assert.equal(sql,'SELECT 1 AS ok');return{async first(){return{ok:1};}};}}},{});
  const result=await connected.json();assert.equal(connected.status,200);assert.deepEqual(result,{ok:true,database:'ready',turnstile:'optional'});
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
    const env={TURNSTILE_REQUIRED:'true',TURNSTILE_SITE_KEY:'site',TURNSTILE_SECRET:'secret',TURNSTILE_HOSTNAMES:'example.com',DB:{prepare(sql){return{bind(){return this;},async first(){if(sql.startsWith('SELECT * FROM users'))return{id:'u',email:'seller@account.geno',name:'seller',role:'seller',password_hash:secured.hash,password_salt:secured.salt};throw new Error(sql);},async run(){if(sql.startsWith('DELETE FROM sessions')||sql.startsWith('INSERT INTO sessions'))return{meta:{changes:1}};throw new Error(sql);}};}}};
    const request=()=>new Request('https://example.com/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountName:'seller',password:'correct-password',turnstileToken:'single-use-token'})});
    assert.equal((await api(request(),env,{})).status,200);
    assert.equal((await api(request(),env,{})).status,403);
  } finally { globalThis.fetch=originalFetch; }
});
