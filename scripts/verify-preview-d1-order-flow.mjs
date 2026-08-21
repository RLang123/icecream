import { chromium, request as playwrightRequest } from "/home/codespace/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const baseURL = process.env.PREVIEW_D1_URL || "http://127.0.0.1:8788";
const outputDir = new URL("../artifacts/korsk-order-preview-d1/", import.meta.url).pathname;
await mkdir(outputDir, { recursive: true });
const runId = crypto.randomUUID();
const password = `Preview-${crypto.randomUUID()}`;

async function seller(accountName) {
  const registration = await playwrightRequest.newContext({ baseURL });
  const response = await registration.post("/api/register", { data: { accountName, password } });
  if (response.status() !== 201) throw new Error(`register ${response.status()}: ${await response.text()}`);
  const user = (await response.json()).user;
  const cookie = response.headers()["set-cookie"]?.split(";")[0];
  await registration.dispose();
  const context = await playwrightRequest.newContext({ baseURL, extraHTTPHeaders: { cookie } });
  return { context, user, cookie };
}

const primary = await seller(`preview_${runId.replaceAll("-", "").slice(0, 20)}`);
const other = await seller(`other_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`);
const project = {
  store: {
    name: `KORSK Preview ${runId}`, tagline: "주문 검증", accent: "#ff6b35", theme: "cream", radius: 22,
    shotPrice: 500, notificationSound: "bell", ingredients: [
      { id: "milk", name: "우유", available: true, stock: 10 },
      { id: "cracker", name: "과자 재료", available: true, stock: 10 },
    ],
  },
  categories: ["전체"],
  items: [
    { id: "latte", name: "딸기라떼", price: 3000, smallPrice: 3000, largePrice: 4000, sizesEnabled: true, temperatureMode: "both", shotsEnabled: true, hotShots: true, iceShots: true, ingredientIds: ["milk"], emoji: "🥛", color: "#f2b6c6" },
    { id: "snack", name: "과자", price: 1500, sizesEnabled: false, temperatureMode: "none", shotsEnabled: false, ingredientIds: ["cracker"], emoji: "🍪", color: "#e8d1a8" },
  ],
};
const saved = await primary.context.put("/api/project", { data: { data: project, inventoryVersion: 0 } });
if (!saved.ok()) throw new Error(`project ${saved.status()}: ${await saved.text()}`);
const slug = (await saved.json()).slug;

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const browserContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
await browserContext.addCookies([{ name: "session", value: primary.cookie.split("=").slice(1).join("="), url: baseURL }]);
const page = await browserContext.newPage();
await page.addInitScript(() => {
  const nativeTimeout = window.setTimeout.bind(window);
  window.setTimeout = (fn, delay, ...args) => nativeTimeout(fn, delay > 1000 ? 900 : delay, ...args);
  window.__alertOscillatorStarts = 0;
  class TestAudioContext {
    state = "running"; currentTime = 0; destination = {};
    resume() { this.state = "running"; return Promise.resolve(); }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    createOscillator() { return { frequency: { setValueAtTime() {} }, connect() {}, start() { window.__alertOscillatorStarts += 1; }, stop() {}, type: "sine" }; }
  }
  window.AudioContext = TestAudioContext; window.webkitAudioContext = TestAudioContext;
});
await page.goto(`${baseURL}/seller`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "주문 화면 열기" }).waitFor();
await page.locator("body").click({ position: { x: 700, y: 300 } });
await page.getByText("주문 알림 켜짐", { exact: true }).waitFor();

async function createOrder(items) {
  const response = await primary.context.post("/api/orders", { data: { storeSlug: slug, items, diningType: "매장", customerName: "UUID 검증", requestKey: crypto.randomUUID() } });
  if (response.status() !== 201) throw new Error(`order ${response.status()}: ${await response.text()}`);
  return response.json();
}

const first = await createOrder([{ id: "latte", size: "S", temperature: "ICE", shots: 0, qty: 1, price: 5000 }]);
await page.getByText("딸기라떼", { exact: true }).waitFor({ timeout: 10000 });
await page.waitForTimeout(1200);
const oneOrderSoundStarts = await page.evaluate(() => window.__alertOscillatorStarts);
await page.waitForTimeout(5200);
const repeatedPollSoundStarts = await page.evaluate(() => window.__alertOscillatorStarts);

const second = await createOrder([{ id: "snack", qty: 1, price: 5000 }]);
await page.locator(".order-list article").filter({ hasText: "과자" }).first().waitFor({ timeout: 10000 });
await page.waitForTimeout(1200);
const twoOrderSoundStarts = await page.evaluate(() => window.__alertOscillatorStarts);
const third = await createOrder([{ id: "snack", qty: 2, price: 5000 }]);
await page.getByText("UUID 검증", { exact: false }).first().waitFor({ timeout: 10000 });
await page.waitForTimeout(1200);
const threeOrderSoundStarts = await page.evaluate(() => window.__alertOscillatorStarts);

const firstCard = page.locator(".order-list article").filter({ hasText: "딸기라떼" }).first();
await firstCard.getByRole("button", { name: "주문 수정" }).click();
await page.getByLabel("딸기라떼 사이즈").selectOption("L");
await page.getByLabel("딸기라떼 샷 횟수").fill("1");
await page.getByLabel("딸기라떼 수량").fill("2");
await page.getByRole("button", { name: "변경 내용 확인" }).click();
await page.screenshot({ path: `${outputDir}order-edit-review.png`, fullPage: false });
const editResponsePromise = page.waitForResponse((response) => response.url().endsWith(`/api/orders/${first.id}`) && response.request().method() === "PATCH");
await page.getByRole("button", { name: "변경사항 저장" }).click();
const editResponse = await editResponsePromise;
const editRequest = editResponse.request().postDataJSON();
const edited = await editResponse.json();
await page.getByText("9,000원", { exact: true }).first().waitFor();
await page.screenshot({ path: `${outputDir}order-card-after-edit.png`, fullPage: false });
const afterEditSoundStarts = await page.evaluate(() => window.__alertOscillatorStarts);

const repeatedEditResponse = await primary.context.patch(`/api/orders/${first.id}`, { data: editRequest });
const repeatedEdit = await repeatedEditResponse.json();
const otherSellerResponse = await other.context.patch(`/api/orders/${first.id}`, { data: { ...editRequest, requestKey: crypto.randomUUID() } });
const projectAfterEdit = await primary.context.get("/api/project");
const stockAfterEdit = (await projectAfterEdit.json()).data.store.ingredients.find((item) => item.id === "milk").stock;

const completeResponse = await primary.context.patch(`/api/orders/${first.id}`, { data: { status: "completed", paymentMethod: "prepaid" } });
const completed = await completeResponse.json();
const editCompletedResponse = await primary.context.patch(`/api/orders/${first.id}`, { data: { ...editRequest, requestKey: crypto.randomUUID() } });
await page.getByRole("button", { name: "분석 화면 열기" }).click();
await page.getByText("9,000원", { exact: true }).first().waitFor({ timeout: 10000 });
await page.getByRole("button", { name: "주문 화면 열기" }).click();
const downloadPromise = page.waitForEvent("download");
await page.getByRole("button", { name: "전체 엑셀" }).click();
const download = await downloadPromise;
const csvPath = `${outputDir}${download.suggestedFilename()}`;
await download.saveAs(csvPath);

const listed = await primary.context.get("/api/orders");
const storedOrder = (await listed.json()).orders.find((order) => order.id === first.id);
const results = {
  runId, sellerIds: [primary.user.id, other.user.id], slug, orderIds: [first.id, second.id, third.id],
  alert: { oneOrderSoundStarts, repeatedPollSoundStarts, twoOrderSoundStarts, threeOrderSoundStarts, afterEditSoundStarts },
  edit: { status: editResponse.status(), total: edited.total, items: edited.items, repeatedStatus: repeatedEditResponse.status(), repeatedDeduplicated: repeatedEdit.deduplicated, stockAfterEdit, otherSellerStatus: otherSellerResponse.status(), completedStatus: completeResponse.status(), completedTotal: completed.total, editCompletedStatus: editCompletedResponse.status() },
  consistency: { storedTotal: storedOrder.total, itemSum: storedOrder.items.reduce((sum, item) => sum + item.price * item.qty, 0), analyticsTextVisible: true, csvPath },
};
await writeFile(`${outputDir}results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));

await browserContext.close(); await browser.close(); await primary.context.dispose(); await other.context.dispose();
const alertStep = oneOrderSoundStarts > 0;
if (!alertStep || repeatedPollSoundStarts !== oneOrderSoundStarts || twoOrderSoundStarts !== oneOrderSoundStarts * 2 || threeOrderSoundStarts !== oneOrderSoundStarts * 3 || afterEditSoundStarts !== threeOrderSoundStarts || edited.total !== 9000 || repeatedEdit.deduplicated !== true || stockAfterEdit !== 8 || otherSellerResponse.status() !== 404 || editCompletedResponse.status() !== 409 || storedOrder.total !== 9000 || results.consistency.itemSum !== 9000) process.exitCode = 1;
