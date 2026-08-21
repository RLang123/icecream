import { chromium } from "/home/codespace/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const base = "http://127.0.0.1:4173";
const slug = "store-korsk-preview";
const out = new URL("../artifacts/korsk-core-final/", import.meta.url).pathname;
await mkdir(out, { recursive: true });

const project = {
  store: {
    name: "KORSK 미리보기 매장",
    tagline: "안전한 주문 테스트",
    heroMessage: "천천히 메뉴를 골라주세요",
    accent: "#ff6b35", theme: "cream", radius: 22, departments: [], shotPrice: 500,
    ingredients: [{ id: "milk", name: "우유", available: true }, { id: "berry", name: "베리", available: false }],
  },
  categories: ["전체", "아이스크림"],
  items: [
    { id: "vanilla", category: "아이스크림", name: "바닐라 아이스크림", desc: "부드러운 바닐라", price: 4500, emoji: "🍨", color: "#f5dfbd", ingredientIds: ["milk"], temperatureMode: "none", shotsEnabled: false, sizesEnabled: false },
    { id: "berry", category: "아이스크림", name: "베리 아이스크림", desc: "상큼한 베리", price: 5200, emoji: "🍓", color: "#f2b6c6", ingredientIds: ["berry"], temperatureMode: "none", shotsEnabled: false, sizesEnabled: false },
  ],
};

const viewports = [
  { width: 360, height: 800, name: "mobile" },
  { width: 390, height: 844, name: "mobile-390" },
  { width: 430, height: 932, name: "mobile-430" },
  { width: 768, height: 1024, name: "tablet-768" },
  { width: 820, height: 1180, name: "tablet" },
  { width: 1180, height: 820, name: "tablet-landscape" },
  { width: 1024, height: 768, name: "desktop-1024" },
  { width: 1366, height: 768, name: "desktop-1366" },
  { width: 1440, height: 900, name: "desktop" },
  { width: 1920, height: 1080, name: "desktop-1920" },
  { width: 819, height: 614, name: "desktop-1024-zoom-125" },
  { width: 683, height: 512, name: "desktop-1024-zoom-150" },
];
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const results = { viewports: {}, actions: {} };

const layout = async (page) => page.evaluate(() => {
  const all = [...document.querySelectorAll("body *")].filter((element) => {
    const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
    return style.position !== "fixed" && rect.width > 0 && rect.right > innerWidth + 1;
  });
  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    overflowLabels: all.slice(0, 5).map((element) => element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 40) || element.className),
  };
});

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  let createdOrder;
  await page.route("**/api/**", async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (path === "/api/me") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "seller", name: "검증 판매자", accountName: "preview", role: "seller" } }) });
    if (path === "/api/project") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: project, slug, inventoryVersion: 1 }) });
    if (path === "/api/orders" && request.method() === "POST") {
      createdOrder = request.postDataJSON();
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ number: 37 }) });
    }
    if (path === "/api/orders") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ orders: [] }) });
    if (path === "/api/business-close") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ closed: false, closure: null, activeOrderCount: 0 }) });
    if (path === `/api/store/${slug}`) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: project }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto(`${base}/seller`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "메뉴 화면 열기" }).waitFor();
  const sellerLayout = await layout(page);
  await page.screenshot({ path: `${out}${viewport.name}-seller.png` });
  if (viewport.name === "desktop") {
    await page.getByRole("button", { name: "도움말", exact: true }).click();
    results.actions.help = await page.locator(".seller-help-modal").isVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "매장 내보내기", exact: true }).click();
    await page.locator(".store-qr img").waitFor();
    results.actions.export = {
      qr: await page.locator(".store-qr img").isVisible(),
      downloadName: await page.getByRole("button", { name: "QR PNG 다운로드" }).isVisible(),
    };
    await page.keyboard.press("Escape");
  }

  await page.goto(`${base}/shop/${slug}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /바닐라 아이스크림/ }).click();
  await page.getByRole("button", { name: /1개 담기/ }).click();
  await page.locator(".cart-btn").click();
  await page.getByRole("button", { name: /주문 접수하기/ }).click();
  await page.getByRole("button", { name: "네, 주문합니다" }).click();
  await page.getByText("주문번호 37").waitFor();
  const shopLayout = await layout(page);
  const soldOutText = await page.goto(`${base}/shop/${slug}`, { waitUntil: "networkidle" }).then(() => page.getByText("오늘은 품절", { exact: true }).first().isVisible());
  await page.screenshot({ path: `${out}${viewport.name}-shop.png` });
  results.viewports[viewport.name] = {
    size: `${viewport.width}x${viewport.height}`,
    sellerLayout, shopLayout,
    menu: await page.getByText("바닐라 아이스크림", { exact: true }).isVisible(),
    price: await page.getByText("4,500원", { exact: true }).isVisible(),
    soldOut: soldOutText,
    orderCreated: createdOrder?.items?.[0]?.id === "vanilla" && createdOrder?.total === 4500,
  };
  await context.close();
}

const auth = await browser.newContext({ viewport: { width: 390, height: 844 } });
const authPage = await auth.newPage();
await authPage.route("**/api/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === "/api/me") return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "로그인이 필요합니다." }) });
  if (path === "/api/turnstile-config") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ enabled: false }) });
  if (path === "/api/login") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "seller", name: "검증 판매자", role: "seller" } }) });
  return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});
await authPage.goto(`${base}/login`, { waitUntil: "networkidle" });
if (!(await authPage.getByRole("dialog", { name: "판매자 로그인" }).isVisible())) {
  await authPage.getByRole("button", { name: /판매자 로그인/ }).first().click();
}
await authPage.screenshot({ path: `${out}mobile-login.png` });
results.actions.login = {
  brand: await authPage.getByText("KORSK", { exact: true }).first().isVisible(),
  dialog: await authPage.getByRole("dialog", { name: "판매자 로그인" }).isVisible(),
  layout: await layout(authPage),
};
await auth.close();

await browser.close();
await writeFile(`${out}results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
const failures = Object.values(results.viewports).some((result) =>
  result.sellerLayout.scrollWidth > result.sellerLayout.clientWidth ||
  result.shopLayout.scrollWidth > result.shopLayout.clientWidth ||
  !result.menu || !result.price || !result.soldOut || !result.orderCreated,
) || !results.actions.login.brand || !results.actions.login.dialog ||
  !results.actions.help || !results.actions.export?.qr || !results.actions.export?.downloadName;
if (failures) process.exitCode = 1;
