import { chromium } from "/tmp/geno-browser/node_modules/playwright/index.mjs";
import fs from "node:fs/promises";
import path from "node:path";

const baseURL=process.env.GENO_VISUAL_URL||"http://127.0.0.1:4173/seller";
const outputDir=path.resolve(process.env.GENO_VISUAL_OUTPUT||"artifacts/order-alert-local");
const project={store:{name:"알림 테스트 매장",tagline:"테스트",accent:"#ff6b35",theme:"cream",radius:22,ingredients:[{id:"milk",name:"우유",available:true},{id:"coffee",name:"커피",available:true,stock:3},{id:"berry",name:"베리",available:false,stock:0}]},categories:["전체","음료"],items:[{id:1,category:"음료",name:"라테",desc:"",price:5000,emoji:"☕",color:"#ddd",soldout:false,ingredientIds:["milk"],temperatureMode:"both",shotsEnabled:false,sizesEnabled:false}]};
const oldOrder={id:"old-order",display_order_number:1,status:"new",customer_name:"기존 고객",dining_type:"매장",created_at:"2026-08-10 09:00:00",items:[{id:1,name:"라테",emoji:"☕",qty:1,price:5000}],total:5000};
const newOrder={...oldOrder,id:"new-order",display_order_number:2,customer_name:"신규 고객",created_at:"2026-08-10 10:00:00"};
await fs.mkdir(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:"/tmp/geno-playwright/chromium-1187/chrome-linux/chrome",args:["--no-sandbox","--autoplay-policy=user-gesture-required"]});
const results=[];
for(const [width,height] of [[390,844],[1440,900]]){
  const page=await browser.newPage({viewport:{width,height}});let orderReads=0;
  await page.addInitScript(()=>{const native=window.setTimeout;window.setTimeout=(fn,delay,...args)=>native(fn,delay>1000?120:delay,...args);});
  await page.route("**/api/**",async route=>{const pathname=new URL(route.request().url()).pathname;let body={};if(pathname==="/api/me")body={user:{name:"테스트 판매자",role:"seller"}};else if(pathname==="/api/project")body=route.request().method()==="GET"?{data:project,slug:"test",inventoryVersion:1}:{slug:"test",inventoryVersion:1};else if(pathname==="/api/orders"){orderReads++;body={orders:orderReads===1?[oldOrder]:[newOrder,oldOrder]};}else if(pathname==="/api/business-close")body={closed:false,closure:null,activeOrderCount:2};await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});});
  await page.goto(baseURL,{waitUntil:"domcontentloaded"});
  await page.locator(".order-alert-status").waitFor();
  await page.locator("body").click({position:{x:width/2,y:height/2}});
  await page.getByText("신규 고객").waitFor({timeout:5000});
  const status=await page.locator(".order-alert-status").innerText();
  const existingCount=await page.getByText("기존 고객",{exact:false}).count();
  const newCount=await page.getByText("신규 고객",{exact:false}).count();
  const screenshot=path.join(outputDir,`${width}x${height}-new-order-alert.png`);
  await page.screenshot({path:screenshot});
  await page.getByRole("button",{name:"알림 확인"}).first().click();
  results.push({viewport:`${width}x${height}`,status,existingCount,newCount,orderReads,screenshot});
  await page.close();
}
const blocked=await browser.newPage({viewport:{width:390,height:844}});let reads=0;
await blocked.addInitScript(()=>{class BlockedAudioContext{constructor(){this.state="suspended";}resume(){return Promise.reject(new Error("blocked"));}}window.AudioContext=BlockedAudioContext;window.webkitAudioContext=BlockedAudioContext;const native=window.setTimeout;window.setTimeout=(fn,delay,...args)=>native(fn,delay>1000?120:delay,...args);});
await blocked.route("**/api/**",async route=>{const pathname=new URL(route.request().url()).pathname;let body={};if(pathname==="/api/me")body={user:{name:"테스트 판매자",role:"seller"}};else if(pathname==="/api/project")body=route.request().method()==="GET"?{data:project,slug:"test",inventoryVersion:1}:{slug:"test",inventoryVersion:1};else if(pathname==="/api/orders"){reads++;body={orders:reads===1?[oldOrder]:[newOrder,oldOrder]};}else if(pathname==="/api/business-close")body={closed:false,closure:null,activeOrderCount:2};await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});});
await blocked.goto(baseURL,{waitUntil:"domcontentloaded"});await blocked.locator(".order-alert-status").waitFor();await blocked.locator("body").click({position:{x:180,y:400}});await blocked.getByText("소리 재생이 차단됐습니다",{exact:false}).waitFor({timeout:5000});
const blockedScreenshot=path.join(outputDir,"390x844-audio-blocked.png");await blocked.screenshot({path:blockedScreenshot});results.push({viewport:"390x844-blocked",warning:true,screenshot:blockedScreenshot});await blocked.close();
await browser.close();await fs.writeFile(path.join(outputDir,"results.json"),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
if(results.slice(0,2).some(result=>!result.status.includes("주문 알림 켜짐")||result.existingCount!==1||result.newCount!==1))process.exitCode=1;
