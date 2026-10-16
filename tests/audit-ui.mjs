import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium, webkit } from '@playwright/test';
const require=createRequire(import.meta.url);
process.env.APP_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'bloknot-audit-ui-'));
process.env.DISABLE_STORAGE_BACKUPS='1';
const app=require('../server.js');
const server=app.startServer(0);await new Promise(r=>server.once('listening',r));
const base='http://127.0.0.1:'+server.address().port;
const out=process.env.AUDIT_ARTIFACTS_DIR || path.join(os.tmpdir(),'bloknot-audit-v421');fs.mkdirSync(out,{recursive:true});
const date=new Date().toISOString().slice(0,10);
const row=id=>({id,start_msk:date+'T08:00',end_msk:date+'T20:00',created_at:date+'T07:00:00Z'});
let journal={sid:'audit-A',revision:1,shifts:[row('original')]};
let browser;
const report={checks:[],errors:[],screenshots:[]};
async function fixture(context){
 await context.route('**/scripts/v421/auth.js',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync(new URL('../scripts/auth.js',import.meta.url),'utf8')+"\nAUTH_ENV_STATE='prod';"}));
 await context.addInitScript(data=>{if(!localStorage.getItem('audit-seeded')){
  localStorage.setItem('audit-seeded','1');localStorage.setItem('shift_tracker_cached_user_v1',JSON.stringify({id:'audit-A',display_name:'Проверка'}));
  localStorage.setItem('shift_tracker_shifts_cache_v1_audit-A',JSON.stringify({userId:'audit-A',shifts:[data]}));
 }},row('original'));
 await context.route('**/api/**',async route=>{
  const req=route.request(), url=new URL(req.url());let body={},status=200;
  if(url.pathname==='/api/auth')body={user:{id:'audit-A',display_name:'Проверка'},sessionToken:'audit-only'};
  if(url.pathname==='/api/shifts'){
   if(req.method()==='PUT'){const payload=req.postDataJSON();if(payload.baseRevision!==journal.revision)status=409;else journal={sid:'audit-A',revision:journal.revision+1,shifts:payload.shifts};}
   body=journal;
  }
  if(url.pathname==='/api/salary-params')body={salaryParams:{}};
  if(url.pathname==='/api/profile')body={profile:{}};
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
}
async function ready(page){await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.JournalBridge?.current() && document.getElementById('monthTitle').textContent.trim());await page.evaluate(()=>JournalBridge.sync());assert(await page.evaluate(()=>JournalBridge.current().revision!==null),JSON.stringify(await page.evaluate(()=>JournalBridge.current())));}
try{
 for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
  browser=await type.launch();const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},timezoneId:'Asia/Vladivostok'});await fixture(context);
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>report.errors.push(name+': '+error.message));
  const loaded=[];page.on('request',req=>loaded.push(new URL(req.url()).pathname));
  await ready(page);await page.addStyleTag({content:'*,*::before,*::after { animation-duration:0s!important;transition:none!important; }'});console.log(name+': ready');await page.evaluate(()=>JournalBridge.sync());
  assert(!loaded.some(x=>x.endsWith('/poekhali-tracker.js')),'tracker blocks initial shell');
  assert(!loaded.some(x=>x.endsWith('/docs-app.js')),'documents block initial shell');
  assert(!loaded.some(x=>x.endsWith('/vu45-ui.js')),'calculator blocks initial shell');report.checks.push(name+': independent core startup');
  for(const width of [360,375,390,430]){
   await page.setViewportSize({width,height:844});await page.locator('.tab-btn[data-tab="add"]').click();
   await page.evaluate(()=>{document.getElementById('inputStartTime').value='23:58';document.getElementById('inputStartTime').dispatchEvent(new Event('change',{bubbles:true}));});
   await page.evaluate(()=>document.fonts.ready);
   const metrics=await page.evaluate(()=>{const time=document.querySelector('[data-datetime-display="inputStartTime"]'),b=time.getBoundingClientRect();return{width:innerWidth,scroll:document.documentElement.scrollWidth,time:time.textContent,timeClient:b.width,timeScroll:time.scrollWidth,hint:0,zoom:document.querySelector('meta[name=viewport]').content};});
   assert.equal(metrics.scroll,width,JSON.stringify(metrics));assert.equal(metrics.time,'23:58');
   const image=path.join(out,`${name}-add-${width}.png`);await page.screenshot({path:image,fullPage:true});report.screenshots.push(image);
  }
  report.checks.push(name+': 360/375/390/430px original layout preserved');
  await page.locator('.tab-btn[data-tab="home"]').click();
  const home=await page.evaluate(()=>({month:[...document.querySelectorAll('.month-btn,.month-tab')].filter(x=>x.getClientRects().length).map(x=>x.getBoundingClientRect().height),shifts:document.getElementById('homeShiftsList').getBoundingClientRect().top,calendar:document.querySelector('.home-calendar-card').getBoundingClientRect().top}));
  assert(home.shifts>home.calendar);await page.screenshot({path:path.join(out,name+'-home.png'),fullPage:true});
  await page.locator('.tab-btn[data-tab="instructions"]').click();await page.waitForFunction(()=>typeof docsFilesCache==='object'&&typeof openDocFile==='function');
  await page.locator('#btnOpenVu45').click();await page.waitForFunction(()=>document.getElementById('overlayVu45').classList.contains('visible')||document.getElementById('overlayVu45').classList.contains('open')||document.getElementById('overlayVu45').classList.contains('active'));await page.locator('#btnCloseVu45').click();
  await page.evaluate(()=>setActiveTab('poekhali'));await page.waitForFunction(()=>typeof window.startPoekhaliTrackerMode==='function');await page.evaluate(()=>setActiveTab('home'));
  report.checks.push(name+': lazy documents/calculator/tracker open');
  // Real IndexedDB transaction, quota abort, account isolation and migration.
  const durable=await page.evaluate(async data=>{
   const {JournalStore}=await import('/scripts/v421/journal/store.mjs');const store=new JournalStore();
   localStorage.setItem('shift_tracker_shifts_pending_v1_migrate',JSON.stringify({userId:'migrate',shifts:[]}));
   localStorage.setItem('shift_tracker_shifts_pending_v1_B',JSON.stringify({userId:'B',shifts:[data]}));
   const migrated=await store.initialize('migrate');const backup=!!migrated.legacyBackup.shift_tracker_shifts_pending_v1_migrate;
   const other=!!localStorage.getItem('shift_tracker_shifts_pending_v1_B');
   const engine=await JournalBridge.prepare('audit-A');const before=await store.get('audit-A');const original=IDBObjectStore.prototype.put;
   IDBObjectStore.prototype.put=function(){throw new DOMException('Simulated full device','QuotaExceededError');};let error=false;
   try{await JournalBridge.save([data]);}catch(_){error=true;}finally{IDBObjectStore.prototype.put=original;}
   const after=await store.get('audit-A');
   return{backup,other,empty:migrated.shifts.length===0&&migrated.pending,removed:!localStorage.getItem('shift_tracker_shifts_pending_v1_migrate'),error,unchanged:JSON.stringify(before.shifts)===JSON.stringify(after.shifts)};
  },row('must-not-save'));
  assert(Object.values(durable).every(Boolean),JSON.stringify(durable));report.checks.push(name+': atomic IDB failure and scoped v1 migration');
  // Delete the final row offline, restart the actual app, then reconnect.
  await page.addInitScript(()=>Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>sessionStorage.getItem('audit-offline')!=='1'}));
  await page.evaluate(async()=>{sessionStorage.setItem('audit-offline','1');Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});await JournalBridge.save([]);});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>JournalBridge.current()?.pending);
  assert.deepEqual(await page.evaluate(()=>allShifts.map(x=>x.id)),[]);
  assert.equal(await page.evaluate(()=>JournalBridge.current().shifts.length),0);
  await page.evaluate(async()=>{sessionStorage.removeItem('audit-offline');Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});await JournalBridge.sync();});
  assert.equal(journal.shifts.length,0);assert.equal(await page.evaluate(()=>JournalBridge.current().pending),false);
  report.checks.push(name+': offline final deletion survives app restart and reconnect');
  // Two tabs share real IDB transactions. Independent additions must both survive.
  const second=await context.newPage();await ready(second);
  await Promise.all([page.evaluate(async data=>{const engine=await JournalBridge.prepare('audit-A');await engine.save([data]);},row('tab-one')),
    second.evaluate(async data=>{const engine=await JournalBridge.prepare('audit-A');await engine.save([data]);},row('tab-two'))]);
  await page.evaluate(()=>JournalBridge.sync());await second.evaluate(()=>JournalBridge.sync());
  assert.deepEqual(journal.shifts.map(x=>x.id).sort(),['tab-one','tab-two']);await second.close();
  report.checks.push(name+': concurrent tabs preserve both additions');
  await context.close();await browser.close();browser=null;
 }
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report,null,2));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));app.closeStorage();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
