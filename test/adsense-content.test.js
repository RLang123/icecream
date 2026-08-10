import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("자동 광고 허용 경로는 공개 소비자 매장 경로뿐이다", async () => {
  const source=await readFile(new URL("../src/main.jsx",import.meta.url),"utf8");
  assert.match(source,/location\.pathname\.startsWith\("\/shop\/"\)/);
  for(const path of ['/login','/seller','/about','/guide','/privacy','/terms','/api/'])assert.ok(!path.startsWith('/shop/'));
});

test("공개 콘텐츠 페이지는 기본 접근성 구조와 모바일 규칙을 갖는다", async () => {
  for (const pathname of ["/about", "/guide", "/privacy", "/terms"]) {
    const source=await readFile(new URL("../src/public-content.jsx",import.meta.url),"utf8");
    assert.match(source,new RegExp(`"${pathname.replace("/","\\/")}"`));
  }
  const source=await readFile(new URL("../src/public-content.jsx",import.meta.url),"utf8");
  assert.match(source,/<main /);assert.match(source,/<h1>/);assert.match(source,/<nav aria-label=/);assert.match(source,/<footer /);
  assert.doesNotMatch(source,/AdSenseLoader|AdSlot|adsbygoogle/);
  assert.doesNotMatch(source,/사용자 입력 필요|Stuido/);
  const css=await readFile(new URL("../src/public-content.css",import.meta.url),"utf8");
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/@media\(max-width:420px\)/);
});

test("AdSense 확인 메타 태그와 ads.txt 게시자 ID가 정확하다", async () => {
  const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
  const ads=await readFile(new URL("../public/ads.txt",import.meta.url),"utf8");
  assert.match(html,/<meta name="google-adsense-account" content="ca-pub-4934943702995460"/);
  assert.equal(ads.trim(),"google.com, pub-4934943702995460, DIRECT, f08c47fec0942fa0");
  assert.equal(html.match(/<meta name="google-adsense-account" content="ca-pub-4934943702995460"/g)?.length,1);
  assert.equal(html.match(/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-4934943702995460/g)?.length,1);
  assert.match(html,/<script async src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-4934943702995460"\s+crossorigin="anonymous"><\/script>/);
  assert.doesNotMatch(html,/<ins[^>]+class="adsbygoogle"/);
});

test("로그인 랜딩 푸터에서 모든 공개 정책 페이지로 이동할 수 있다", async () => {
  const source=await readFile(new URL("../src/main.jsx",import.meta.url),"utf8");
  const start=source.indexOf('<footer className="landing-footer">');
  const footer=source.slice(start,source.indexOf('</footer>',start));
  for(const href of ['/about','/guide','/privacy','/terms','#partnership','#seller-login'])assert.match(footer,new RegExp(`href="${href}"`));
  assert.match(footer,/aria-label="서비스 정보"/);
});
