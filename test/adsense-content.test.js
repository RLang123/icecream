import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  canLoadAdsense,
  canRenderAd,
  createAdsenseConfig,
} from "../src/adsense-policy.js";

const active = {
  enabled: true,
  client: "ca-pub-4934943702995460",
  slot: "1234567890",
};

test("광고 설정이 없거나 유효하지 않으면 외부 광고 로딩 조건이 성립하지 않는다", () => {
  assert.deepEqual(createAdsenseConfig(),{enabled:false,client:"",slot:""});
  assert.equal(canLoadAdsense("/about", { enabled: false, client: active.client }), false);
  assert.equal(canLoadAdsense("/about", { enabled: true, client: "" }), false);
  assert.equal(canLoadAdsense("/about", { enabled: true, client: "ca-pub-invalid" }), false);
  assert.equal(canRenderAd("/about", { ...active, slot: "" }), false);
});

test("차단 경로에서 AdSlot은 아무것도 렌더링하지 않는다", () => {
  for (const pathname of ["/login", "/seller", "/shop/store-12345678", "/privacy", "/terms", "/api/me"])
    assert.equal(canRenderAd(pathname,active),false);
});

test("허용 경로도 활성 설정과 유효한 client 및 slot이 모두 있어야 렌더링한다", () => {
  assert.equal(canRenderAd("/about",{...active,enabled:false}),false);
  assert.equal(canRenderAd("/guide",{...active,slot:"bad-slot"}),false);
  assert.equal(canRenderAd("/about",active),true);
  assert.equal(canRenderAd("/guide",active),true);
});

test("공개 콘텐츠 페이지는 기본 접근성 구조와 모바일 규칙을 갖는다", async () => {
  for (const pathname of ["/about", "/guide", "/privacy", "/terms"]) {
    const source=await readFile(new URL("../src/public-content.jsx",import.meta.url),"utf8");
    assert.match(source,new RegExp(`"${pathname.replace("/","\\/")}"`));
  }
  const source=await readFile(new URL("../src/public-content.jsx",import.meta.url),"utf8");
  assert.match(source,/<main /);assert.match(source,/<h1>/);assert.match(source,/<nav aria-label=/);assert.match(source,/<footer /);
  const adSource=await readFile(new URL("../src/adsense.jsx",import.meta.url),"utf8");
  assert.match(adSource,/if \(!active\) return null/);
  assert.doesNotMatch(adSource,/ADVERTISEMENT/);
  assert.doesNotMatch(source,/사용자 입력 필요|Stuido/);
  assert.ok(source.indexOf('<div className="content-sections">') < source.indexOf('<AdSlot pathname={pathname}'));
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
  assert.doesNotMatch(html,/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/);
});

test("로그인 랜딩 푸터에서 모든 공개 정책 페이지로 이동할 수 있다", async () => {
  const source=await readFile(new URL("../src/main.jsx",import.meta.url),"utf8");
  const start=source.indexOf('<footer className="landing-footer">');
  const footer=source.slice(start,source.indexOf('</footer>',start));
  for(const href of ['/about','/guide','/privacy','/terms','#partnership','#seller-login'])assert.match(footer,new RegExp(`href="${href}"`));
  assert.match(footer,/aria-label="서비스 정보"/);
});
