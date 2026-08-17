import { chromium } from "/home/codespace/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.VERIFY_BASE_URL || "http://127.0.0.1:8788";
const slug = "store-0180123a";
const out = new URL("../artifacts/hero-message-preview/", import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = {};
const shot = (page, name) => page.screenshot({ path: `${out}${name}.png` });

const seller = await browser.newContext();
await seller.addCookies([{ name: "session", value: "hero-preview-session-device-b", url: base }]);
const page = await seller.newPage();
await page.setViewportSize({ width: 360, height: 800 });
await page.goto(`${base}/`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "판매자 메뉴 더보기" }).click();
await page.getByRole("button", { name: "도움말" }).click();
await page.locator(".seller-help-modal").evaluate(element => { element.scrollTop = element.scrollHeight; });
await shot(page, "seller-help-actual-bottom-360x800");
results.help = await page.locator(".seller-help-modal").evaluate(element => ({ scrollTop: element.scrollTop, maxScroll: element.scrollHeight - element.clientHeight, lastBottom: element.querySelector(".seller-help-content p:last-child").getBoundingClientRect().bottom, modalBottom: element.getBoundingClientRect().bottom }));

for (const viewport of [{ width: 768, height: 1024 }, { width: 820, height: 1180 }]) {
  await page.setViewportSize(viewport);
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "상단 보조 기능 더보기" }).click();
  await shot(page, `seller-preview-access-${viewport.width}x${viewport.height}`);
  results[`tablet-${viewport.width}`] = { previewActionVisible: await page.getByRole("button", { name: "미리보기", exact: true }).isVisible() };
}

const bulkOrders = Array.from({ length: 18 }, (_, index) => ({
  id: `bulk-${index}`,
  number: index + 1,
  customer_name: `긴 부서 이름의 주문 고객 ${index + 1}`,
  items: [{ id: "visual-1", name: "아주 긴 이름의 솔티드 카라멜 더블 크런치 아이스크림 선데", qty: 2, price: 4800 }],
  total: 9600,
  dining_type: index % 2 ? "포장" : "매장",
  department: "아주 긴 이름의 운영지원 부서",
  status: index % 3 === 0 ? "preparing" : "new",
  created_at: new Date(Date.now() - index * 60000).toISOString(),
  payment_attempt_count: 0,
}));
await page.route("**/api/orders**", route => route.request().method() === "GET" ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ orders: bulkOrders, page: 1, limit: 50 }) }) : route.continue());
for (const viewport of [{ width: 360, height: 800 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
  await page.setViewportSize(viewport);
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "주문 화면 열기" }).click();
  await page.waitForTimeout(400);
  await shot(page, `seller-bulk-orders-${viewport.width}x${viewport.height}`);
  results[`orders-${viewport.width}`] = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, cards: document.querySelectorAll(".order-list article").length }));
}
await seller.close();

const loadingContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
await loadingContext.route(`**/api/store/${slug}`, async route => { await new Promise(resolve => setTimeout(resolve, 4000)); await route.continue(); });
const loading = await loadingContext.newPage();
await loading.goto(`${base}/shop/${slug}`, { waitUntil: "domcontentloaded" });
await loading.getByText("매장 메뉴를 불러오는 중...").waitFor();
await shot(loading, "consumer-loading-390x844");
await loadingContext.close();

const errorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
await errorContext.route(`**/api/store/${slug}`, route => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "매장 메뉴를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }) }));
const errorPage = await errorContext.newPage();
await errorPage.goto(`${base}/shop/${slug}`, { waitUntil: "networkidle" });
await errorPage.getByRole("button", { name: "다시 시도" }).waitFor();
await shot(errorPage, "consumer-error-390x844");
results.errorText = await errorPage.locator(".auth-loading p").textContent();
await errorContext.close();

await browser.close();
await writeFile(`${out}state-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
