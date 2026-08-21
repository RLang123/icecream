import { chromium } from "/home/codespace/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs";
import fs from "node:fs/promises";
import path from "node:path";

const baseURL = process.env.GENO_VISUAL_URL || "http://127.0.0.1:4173/seller";
const outputDir = path.resolve(process.env.GENO_VISUAL_OUTPUT || "artifacts/responsive");
const viewports = [[360,800],[390,844],[430,932],[768,1024],[820,1180],[1024,768],[1440,900]];
const project = {
  store: { name: "매우 긴 매장 이름 테스트 KORSK Mellow Cream 플래그십", tagline: "오늘을 달콤하게 만드는 한 스쿱", accent: "#ff6b35", theme: "cream", radius: 22, ingredients: Array.from({length:8},(_,i)=>({id:`ingredient-${i}`,name:i===0?"유기농 저지방 우유와 아주 긴 재료 이름":"재료 "+(i+1),available:i!==1,...(i===2?{stock:3}:{})})) },
  categories: ["전체","시그니처"],
  items: [{id:1,category:"시그니처",name:"아주 긴 메뉴 이름 피스타치오 클라우드 스페셜",desc:"설명",price:5800,emoji:"🍦",color:"#cddcad",soldout:false,ingredientIds:["ingredient-0"],temperatureMode:"both",shotsEnabled:true,hotShots:true,iceShots:true,sizesEnabled:true,smallPrice:5200,largePrice:5800}]
};
await fs.mkdir(outputDir,{recursive:true});
const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
const results=[];
for (const [width,height] of viewports) {
  const page=await browser.newPage({viewport:{width,height}});
  await page.route("**/api/**",async route=>{
    const pathname=new URL(route.request().url()).pathname;
    let body={};
    if(pathname==="/api/me") body={user:{name:"테스트 판매자",accountName:"test",role:"seller"}};
    else if(pathname==="/api/project") body=route.request().method()==="GET"?{data:project,slug:"test-store",inventoryVersion:1}:{slug:"test-store",inventoryVersion:1};
    else if(pathname==="/api/orders") body={orders:[]};
    else if(pathname==="/api/business-close") body={closed:false,closure:null,activeOrderCount:0};
    else body={};
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
  });
  await page.goto(baseURL,{waitUntil:"networkidle"});
  const labels=["메뉴","재료","주문","분석"];
  const checks=[];
  for(const label of labels){
    const selector=width<=767?`.mobile-bottom-nav button[aria-label="${label} 화면 열기"]`:`.sidebar button[aria-label="${label} 화면 열기"]`;
    await page.locator(selector).click();
    await page.waitForTimeout(80);
    checks.push({screen:label,scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth),clientWidth:await page.evaluate(()=>document.documentElement.clientWidth)});
  }
  if(width<=767){
    await page.locator('.mobile-bottom-nav button[aria-label="판매자 메뉴 더보기"]').click();
    await page.locator('.mobile-more-grid button[aria-label="설정 화면 열기"]').click();
    checks.push({screen:"설정",scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth),clientWidth:await page.evaluate(()=>document.documentElement.clientWidth)});
    await page.locator('.mobile-bottom-nav button[aria-label="판매자 메뉴 더보기"]').click();
    await page.locator('.mobile-more-grid button[aria-label="판매자 도움말 열기"]').click();
    const modal=page.locator('.seller-help-modal');
    const box=await modal.boundingBox();
    checks.push({screen:"도움말",modalInside:!!box&&box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height});
    await page.keyboard.press("Escape");
  } else {
    await page.locator('.sidebar button[aria-label="설정 화면 열기"]').click();
    checks.push({screen:"설정",scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth),clientWidth:await page.evaluate(()=>document.documentElement.clientWidth)});
    await page.locator('.sidebar-bottom button').click();
    const box=await page.locator('.seller-help-modal').boundingBox();
    checks.push({screen:"도움말",modalInside:!!box&&box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height});
    await page.keyboard.press("Escape");
  }
  const ingredientSelector=width<=767?'.mobile-bottom-nav button[aria-label="재료 화면 열기"]':'.sidebar button[aria-label="재료 화면 열기"]';
  await page.locator(ingredientSelector).click();
  const touchFailures=await page.locator(width<=1199?'.ingredient-list button:visible, .mobile-bottom-nav button:visible':'__never__').evaluateAll(nodes=>nodes.filter(node=>{const r=node.getBoundingClientRect();return r.width<44||r.height<44}).map(node=>({label:node.getAttribute('aria-label')||node.textContent.trim(),width:Math.round(node.getBoundingClientRect().width),height:Math.round(node.getBoundingClientRect().height)})));
  const fixedNavOverlap=width<=767?await page.evaluate(()=>{
    const panel=document.querySelector('.control-panel');const nav=document.querySelector('.mobile-bottom-nav');
    if(!panel||!nav)return true;
    const paddingBottom=parseFloat(getComputedStyle(panel).paddingBottom);return paddingBottom<nav.getBoundingClientRect().height;
  }):false;
  const file=path.join(outputDir,`${width}x${height}-ingredients.png`);
  await page.screenshot({path:file,fullPage:false});
  const overflow=checks.some(check=>check.scrollWidth>check.clientWidth);
  results.push({viewport:`${width}x${height}`,url:baseURL,horizontalOverflow:overflow,fixedNavOverlap,touchFailures,checks,screenshot:file});
  await page.close();
}
await browser.close();
await fs.writeFile(path.join(outputDir,"results.json"),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
if(results.some(result=>result.horizontalOverflow||result.fixedNavOverlap||result.touchFailures.length||result.checks.some(check=>check.modalInside===false))) process.exitCode=1;
