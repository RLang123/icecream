import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import worker, { api, sellerAccount, sellerAccountError } from "../worker/index.js";
import { createClosingXlsx, closingFilename, closingWorkbookRows } from "../src/closing-xlsx.js";

test("계정 이름은 trim+NFKC 후 한글·영문·숫자·허용 기호를 호환 키로 만든다", () => {
  const composed=sellerAccount({accountName:"  카페Geno_01  "});
  const decomposed=sellerAccount({accountName:"ㅋㅏㅍㅔGeno_01"});
  assert.equal(composed.raw,"카페Geno_01");
  assert.equal(decomposed.raw,"카페Geno_01");
  assert.equal(composed.email,decomposed.email);
  assert.equal(sellerAccountError(composed,"password-123"),null);
  assert.match(sellerAccountError(sellerAccount({accountName:"카페 이름!"}),"password-123"),/기호/);
});

test("회원가입은 실제 UNIQUE만 409, 형식은 400, DB 실패는 500이다", async () => {
  const request=(accountName)=>new Request("https://example.com/api/register",{method:"POST",headers:{"content-type":"application/json","x-forwarded-for":crypto.randomUUID()},body:JSON.stringify({accountName,password:"password-123"})});
  const uniqueEnv={DB:{prepare(sql){return{bind(){return this;},async first(){return null;},async run(){return{meta:{changes:0}};}};},async batch(){throw new Error("D1_ERROR: UNIQUE constraint failed: users.email");}}};
  assert.equal((await api(request("한글Geno01"),uniqueEnv,{})).status,409);
  const invalidEnv={DB:{prepare(){throw new Error("형식 오류는 DB를 조회하면 안 됨");}}};
  assert.equal((await api(request("잘못 된 이름!"),invalidEnv,{})).status,400);
  const failedEnv={DB:{prepare(sql){return{bind(){return this;},async first(){if(sql.includes("SELECT id FROM users"))return null;throw new Error("db down");},async run(){throw new Error("db down");}};},async batch(){throw new Error("db down");}}};
  assert.equal((await worker.fetch(request("정상계정01"),failedEnv,{})).status,500);
});

test("실제 xlsx ZIP은 3개 시트와 D1 집계 값을 포함하고 민감 필드가 없다", () => {
  const closure={business_date:"2026-08-09",total_order_amount:30000,cancelled_amount:5000,refunded_amount:7000,net_revenue:18000,total_order_count:3,completed_order_count:1,cancelled_order_count:2,closed_at:"2026-08-09 12:00:00"};
  const orders=[{number:1,status:"completed",total:18000,payment_method:"cash",created_at:"2026-08-09 01:00:00"},{number:2,status:"cancelled",total:5000},{number:3,status:"refunded",total:7000}];
  const rows=closingWorkbookRows(closure,orders);
  assert.equal(rows[2][1][2],18000);assert.equal(rows[2][2][2],5000);assert.equal(rows[2][3][2],7000);
  const bytes=createClosingXlsx(closure,orders);assert.equal(strFromU8(bytes.subarray(0,2)),"PK");
  const files=unzipSync(bytes);assert.ok(files["xl/worksheets/sheet3.xml"]);
  const all=Object.values(files).map(strFromU8).join(" ");
  for(const forbidden of ["password","session","token","customer_id","seller_id"])assert.doesNotMatch(all,new RegExp(forbidden,"i"));
  assert.equal(closingFilename("한글/매장","2026-08-09"),"GENO_한글_매장_2026-08-09_영업마감.xlsx");
});

test("도움말·QR·공유 UI와 로컬 QR 생성이 연결되어 있다", async () => {
  const source=await readFile(new URL("../src/main.jsx",import.meta.url),"utf8");
  assert.match(source,/QRCode\.toDataURL\(links\.customer/);assert.match(source,/QR PNG 다운로드/);assert.match(source,/navigator\.share/);
  assert.match(source,/event\.key === "Escape"/);assert.match(source,/requestAnimationFrame\(\(\) => helpButtonRef\.current\?\.focus/);
  for(const heading of ["매장 만들기","소비자 페이지 공유","메뉴·재료 관리","주문 처리와 주문번호 1~100","영업 종료와 재개","Excel 마감 파일","취소·환불 주의사항"])assert.match(source,new RegExp(heading));
});

test("0011은 기존 UNIQUE와 주문·결제 연결을 파괴하지 않는 추가형 마이그레이션이다", async () => {
  const sql=await readFile(new URL("../migrations/0011_business_reopen_and_login_stats.sql",import.meta.url),"utf8");
  assert.match(sql,/last_login_at/);assert.match(sql,/login_count/);assert.match(sql,/business_operation_requests/);assert.match(sql,/UNIQUE \(seller_id, request_key\)/);
  assert.doesNotMatch(sql,/DELETE|DROP|UPDATE orders|payment_attempts/i);
});
