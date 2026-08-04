import test from "node:test";
import assert from "node:assert/strict";
import { api, PASSWORD_POLICY, passwordHash } from "../worker/index.js";

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

test("만료 세션은 인증되지 않는다", async () => {
  const env={DB:{prepare(sql){return{bind(){return this;},async first(){assert.match(sql,/expires_at > datetime/);return null;}};}}};
  const response=await api(new Request("https://example.com/api/me",{headers:{cookie:"session=expired"}}),env,{waitUntil(){}});
  assert.equal(response.status,401);
});
