import { chromium } from "/home/codespace/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:8788";
const out = new URL("../artifacts/hero-message-preview/", import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
await context.route("**/api/**", async route => {
  const headers = { ...route.request().headers() };
  if (["POST", "PUT", "PATCH", "DELETE"].includes(route.request().method())) {
    delete headers.origin;
    delete headers["sec-fetch-site"];
    const response = await route.fetch({ headers });
    await route.fulfill({ response });
    return;
  }
  await route.continue({ headers });
});
const account = "hero-preview-audit-20260810";
const customMessage = "오늘의 달콤한 순간, 우리 매장의 특별한 메뉴를 천천히 골라보세요!";
const results = { base, account, screenshots: [], viewports: {}, persistence: {} };
const shot = async (target, name, fullPage = false) => {
  const path = `${out}${name}.png`;
  await target.screenshot({ path, fullPage });
  results.screenshots.push(path);
};

await context.addCookies([{ name: "session", value: "hero-preview-session-device-a", url: base }]);
await page.goto(`${base}/`, { waitUntil: "networkidle" });
await page.locator(".app").waitFor();
await page.waitForTimeout(900);

await page.getByRole("button", { name: "설정 화면 열기" }).click();
const heroField = page.locator(".hero-message-editor textarea");
await heroField.waitFor();
results.persistence.defaultValue = await heroField.inputValue();
await heroField.fill(customMessage);
results.persistence.livePreview = await page.locator(".preview-area .hero h1").textContent();
await page.getByRole("button", { name: "대표 문구 저장" }).click();
await page.waitForTimeout(1800);
results.persistence.savedStatus = await page.locator(".hero-message-status").textContent();
if (!results.persistence.savedStatus.includes("저장했어요")) {
  await shot(page, "seller-settings-save-error-1440x900");
  throw new Error(`대표 문구 저장 상태: ${results.persistence.savedStatus}`);
}
await shot(page, "seller-settings-saved-1440x900");

const prepared = await page.evaluate(async () => {
  const response = await fetch("/api/project");
  const project = await response.json();
  const data = project.data;
  data.store.name = "아주 긴 이름의 달콤한 오후 테스트 카페 153호점";
  data.store.tagline = "천천히 골라도 괜찮아요 · 오늘 가장 마음에 드는 달콤함";
  data.store.ingredients = [
    { id: "milk", name: "우유", available: true, stock: 50 },
    { id: "berry", name: "베리", available: false, stock: 0 },
  ];
  data.categories = ["전체", "시그니처", "음료", "디저트"];
  data.items = Array.from({ length: 14 }, (_, index) => ({
    id: `visual-${index + 1}`,
    category: index % 3 === 0 ? "시그니처" : index % 3 === 1 ? "음료" : "디저트",
    name: index === 0 ? "아주 긴 이름의 솔티드 카라멜 더블 크런치 아이스크림 선데" : `실제 화면 검증 메뉴 ${index + 1}`,
    desc: index === 0 ? "바삭한 크럼블과 진한 카라멜, 부드러운 아이스크림이 함께 들어간 긴 설명입니다." : `메뉴 ${index + 1}의 재료와 맛을 알려주는 설명`,
    price: 4800 + index * 300,
    largePrice: 4800 + index * 300,
    emoji: index % 2 ? "☕" : "🍨",
    color: index % 2 ? "#d8c3a5" : "#f2b6c6",
    badge: index === 0 ? "BEST" : index === 1 ? "NEW" : "",
    soldout: index === 2,
    ingredientIds: index === 3 ? ["berry"] : ["milk"],
    temperatureMode: "none",
    shotsEnabled: false,
    sizesEnabled: false,
  }));
  const saved = await fetch("/api/project", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data, inventoryVersion: project.inventoryVersion }) });
  if (!saved.ok) throw new Error(await saved.text());
  return { ...(await saved.json()), heroMessage: data.store.heroMessage };
});
results.persistence.apiPreserved = prepared.heroMessage;
results.slug = prepared.slug;

await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: "설정 화면 열기" }).click();
results.persistence.afterReload = await page.locator(".hero-message-editor textarea").inputValue();
await page.evaluate(() => fetch("/api/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }));
await context.addCookies([{ name: "session", value: "hero-preview-session-device-b", url: base }]);
await page.goto(`${base}/`, { waitUntil: "networkidle" });
await page.locator(".app").waitFor();
await page.getByRole("button", { name: "설정 화면 열기" }).click();
results.persistence.afterRelogin = await page.locator(".hero-message-editor textarea").inputValue();

for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
  const p = await context.newPage();
  await p.setViewportSize(viewport);
  await p.goto(`${base}/shop/${prepared.slug}`, { waitUntil: "networkidle" });
  const key = `${viewport.width}x${viewport.height}`;
  await shot(p, `consumer-menu-${key}`);
  const metrics = await p.evaluate(() => {
    const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
    const cards = [...document.querySelectorAll(".product")].map(card => {
      const r = card.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, name: card.querySelector("h3")?.textContent, soldout: card.classList.contains("is-soldout") };
    });
    const top = [rect(".kiosk-head"), rect(".hero"), rect(".category-row")];
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      topHeight: top.reduce((sum, item) => sum + (item?.height || 0), 0),
      viewportHeight: innerHeight,
      menuViewportHeight: rect(".product-grid")?.height,
      cards,
      hero: document.querySelector(".hero h1")?.textContent,
    };
  });
  results.viewports[key] = metrics;
  await p.getByRole("button", { name: "시그니처", exact: true }).click();
  await shot(p, `consumer-category-${key}`);
  await p.getByRole("button", { name: "전체", exact: true }).click();
  await p.locator(".product:not(.is-soldout)").first().click();
  await p.locator(".add-button").click();
  await p.locator(".cart-btn").click();
  await shot(p, `consumer-cart-one-${key}`);
  const oneCart = await p.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, rows: document.querySelectorAll(".cart-list>div").length }));
  await p.locator(".back").click();
  await p.locator(".product:not(.is-soldout)").nth(1).click();
  await p.locator(".add-button").click();
  await p.locator(".cart-btn").click();
  await shot(p, `consumer-cart-multiple-${key}`);
  const multiCart = await p.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, rows: document.querySelectorAll(".cart-list>div").length }));
  results.viewports[key].cart = { one: oneCart, multiple: multiCart };
  await p.close();
}

for (const viewport of [{ width: 768, height: 1024 }, { width: 820, height: 1180 }, { width: 1024, height: 768 }, { width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
  await page.setViewportSize(viewport);
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "메뉴 화면 열기" }).click();
  await page.waitForTimeout(250);
  const key = `${viewport.width}x${viewport.height}`;
  await shot(page, `seller-menu-${key}`);
  results.viewports[`seller-${key}`] = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    previewVisible: !!document.querySelector(".preview-area") && getComputedStyle(document.querySelector(".preview-area")).display !== "none",
    previewNames: [...document.querySelectorAll(".preview-area .product-info h3")].slice(0, 4).map(x => x.textContent),
  }));
}

await page.setViewportSize({ width: 360, height: 800 });
await page.goto(`${base}/`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "판매자 메뉴 더보기" }).click();
await page.getByRole("button", { name: "도움말" }).click();
await page.locator(".seller-help-content").evaluate(element => { element.scrollTop = element.scrollHeight; });
await shot(page, "seller-help-bottom-360x800");

const landing = await browser.newPage({ viewport: { width: 360, height: 800 } });
await landing.goto(`${base}/`, { waitUntil: "networkidle" });
await shot(landing, "landing-360x800");
results.landingLogin = await landing.getByRole("button", { name: "판매자 로그인" }).evaluate(element => ({ text: element.innerText, lines: Math.round(element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight)) }));
await landing.close();

await browser.close();
await writeFile(`${out}results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
