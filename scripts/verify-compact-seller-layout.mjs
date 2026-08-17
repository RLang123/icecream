import { chromium } from "/home/codespace/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const base = "http://127.0.0.1:4173";
const out = new URL("../artifacts/compact-seller-preview/", import.meta.url).pathname;
await mkdir(out, { recursive: true });
const data = {
  store: {
    name: "아주 긴 이름의 달콤한 오후 테스트 카페 153호점",
    tagline: "천천히 골라도 괜찮아요 · 오늘 가장 마음에 드는 달콤함",
    heroMessage: "오늘의 달콤한 순간, 우리 매장의 특별한 메뉴를 천천히 골라보세요!",
    accent: "#ff6b35", theme: "cream", radius: 22, departments: [], shotPrice: 500,
    ingredients: [{ id: "milk", name: "우유", available: true }, { id: "berry", name: "베리", available: false }],
  },
  categories: ["전체", "시그니처", "음료", "디저트"],
  items: Array.from({ length: 18 }, (_, index) => ({
    id: `compact-${index}`, category: index % 2 ? "음료" : "시그니처",
    name: index === 0 ? "아주 긴 이름의 솔티드 카라멜 더블 크런치 아이스크림 선데" : `압축 화면 검증 메뉴 ${index + 1}`,
    desc: index === 0 ? "바삭한 크럼블과 진한 카라멜, 부드러운 아이스크림이 함께 들어간 자세한 설명" : `메뉴 ${index + 1}의 재료와 맛을 알려주는 설명`,
    price: 4800 + index * 200, largePrice: 4800 + index * 200, emoji: index % 2 ? "☕" : "🍨",
    color: index % 2 ? "#d8c3a5" : "#f2b6c6", badge: index === 0 ? "BEST" : index === 1 ? "NEW" : "",
    soldout: index === 2, ingredientIds: index === 3 ? ["berry"] : ["milk"], temperatureMode: "none", shotsEnabled: false, sizesEnabled: false,
  })),
};
const browser = await chromium.launch({ headless: true });
const results = {};

async function makePage(viewport, scale = 1) {
  const effectiveViewport = scale === 1 ? viewport : {
    width: Math.round(viewport.width / scale),
    height: Math.round(viewport.height / scale),
  };
  const context = await browser.newContext({ viewport: effectiveViewport });
  const page = await context.newPage();
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/me") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "fixture", name: "레이아웃 검증", role: "seller" } }) });
    if (path === "/api/project") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data, slug: "store-compact1", inventoryVersion: 1 }) });
    if (path === "/api/orders") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ orders: [] }) });
    if (path === "/api/business-close") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ closure: null, activeOrderCount: 0, inconsistent: false }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "메뉴 화면 열기" }).evaluate(element => element.click());
  await page.waitForTimeout(250);
  return { context, page };
}

const cases = [
  { viewport: { width: 768, height: 1024 }, name: "768x1024", scale: 1 },
  { viewport: { width: 820, height: 1180 }, name: "820x1180", scale: 1 },
  { viewport: { width: 1024, height: 768 }, name: "1024x768", scale: 1 },
  { viewport: { width: 1024, height: 768 }, name: "1024x768-zoom-125", scale: 1.25 },
  { viewport: { width: 1024, height: 768 }, name: "1024x768-zoom-150", scale: 1.5 },
  { viewport: { width: 1366, height: 768 }, name: "1366x768", scale: 1 },
  { viewport: { width: 1440, height: 900 }, name: "1440x900", scale: 1 },
];

for (const testCase of cases) {
  const { context, page } = await makePage(testCase.viewport, testCase.scale);
  const info = await page.evaluate(() => {
    const visible = element => !!element && getComputedStyle(element).display !== "none" && element.getBoundingClientRect().width > 0;
    const panel = document.querySelector(".control-panel");
    const stage = document.querySelector(".device-stage");
    const names = [...document.querySelectorAll(".preview-area .product-info h3")].slice(0, 4);
    const descriptions = [...document.querySelectorAll(".preview-area .product-info p")].slice(0, 4);
    const prices = [...document.querySelectorAll(".preview-area .product-info strong")].slice(0, 4);
    return {
      innerWidth, innerHeight, documentWidth: document.documentElement.scrollWidth,
      editorVisible: visible(panel), previewVisible: visible(document.querySelector(".preview-area")),
      panelClientHeight: panel?.clientHeight || 0, panelScrollHeight: panel?.scrollHeight || 0,
      stageClientHeight: stage?.clientHeight || 0, stageScrollHeight: stage?.scrollHeight || 0,
      names: names.map(x => ({ text: x.textContent, visible: visible(x) })),
      descriptions: descriptions.map(x => ({ text: x.textContent, visible: visible(x) })),
      prices: prices.map(x => ({ text: x.textContent, visible: visible(x) })),
      header: {
        preview: visible(document.querySelector('[aria-label="고객 화면 미리보기"]')),
        export: visible(document.querySelector('[aria-label="매장 내보내기"]')),
        user: visible(document.querySelector(".profile-trigger")),
      },
    };
  });
  if (!info.previewVisible && info.innerWidth <= 900) {
    const more = page.getByRole("button", { name: info.innerWidth <= 767 ? "상단 보조 기능 더보기" : "상단 보조 기능 더보기" });
    await more.evaluate(element => element.click());
    info.transitionActions = {
      preview: await page.getByRole("button", { name: "미리보기", exact: true }).isVisible(),
      export: await page.getByRole("button", { name: "매장 내보내기", exact: true }).isVisible(),
      import: await page.getByRole("button", { name: "프로젝트 가져오기", exact: true }).isVisible(),
    };
  }
  if (info.previewVisible) {
    info.independentScroll = await page.evaluate(() => {
      const panel = document.querySelector(".control-panel"); const stage = document.querySelector(".device-stage");
      panel.scrollTop = 140; stage.scrollTop = 24;
      return { panel: panel.scrollTop, stage: stage.scrollTop };
    });
  }
  await page.screenshot({ path: `${out}${testCase.name}.png` });
  if (testCase.scale !== 1 && info.transitionActions?.preview) {
    await page.getByRole("button", { name: "미리보기", exact: true }).evaluate(element => element.click());
    await page.locator(".kiosk .product-info").first().waitFor();
    info.openedPreview = await page.locator(".kiosk .product-info").first().evaluate(element => ({
      name: element.querySelector("h3")?.textContent,
      description: element.querySelector("p")?.textContent,
      price: element.querySelector("strong")?.textContent,
    }));
    await page.screenshot({ path: `${out}${testCase.name}-preview-open.png` });
  }
  results[testCase.name] = info;
  if (testCase.name === "1024x768") {
    await page.getByRole("button", { name: "도움말", exact: true }).click();
    await page.locator(".seller-help-modal").evaluate(element => { element.scrollTop = element.scrollHeight; });
    await page.screenshot({ path: `${out}1024x768-help-bottom.png` });
    results.help = await page.locator(".seller-help-modal").evaluate(element => ({ bottom: element.getBoundingClientRect().bottom, lastBottom: element.querySelector("p:last-child").getBoundingClientRect().bottom }));
  }
  await context.close();
}

await browser.close();
await writeFile(`${out}results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
