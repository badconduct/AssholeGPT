import { chromium } from 'playwright';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';
import { createGame, nextRound } from '../lib/game.js';
import { saveStore } from '../lib/save-store.js';
import http from 'node:http';

const temp=await mkdtemp(join(tmpdir(),'island-browser-'));
const server=createApp({mode:'local'},{saveDir:temp,turnDelay:5,jokerDelay:0});server.listen(0,'127.0.0.1');await once(server,'listening');
let browser,modelApp,modelProvider;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
  // Speed up polls only inside this disposable acceptance browser.
  await page.addInitScript(()=>{const later=window.setTimeout;window.setTimeout=function(fn,ms){return later(fn,ms===700?25:ms);};});
  page.on('pageerror',e=>errors.push(e.message));
  await mkdir('artifacts',{recursive:true});
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  async function clickPost(selector,target=page){const [r]=await Promise.all([target.waitForResponse(r=>r.url().indexOf('/api/')>=0&&r.request().method()==='POST'),target.locator(selector).click()]);await r.finished();}
  await page.waitForFunction(()=>document.getElementById('message').innerText==='Pull up a camping chair.');
  await page.screenshot({path:'artifacts/lobby-800x600.png',fullPage:true});
  for(const count of [8,5]){
    await page.evaluate(()=>Island.menu());
    await page.locator('#matching').selectOption(count===8?'true':'false');await page.locator('#twos').selectOption(count===8?'wild':'high');await page.locator('#jokers').selectOption(count===8?'true':'false');
    await page.locator('#pileMode').selectOption(count===8?'single-lap':'continuous');
    await page.evaluate(()=>Island.menu());await page.locator('#name').fill('River');await page.locator('#count').selectOption(String(count));await clickPost('#start');
    await page.waitForFunction(()=>document.querySelectorAll('.seat').length>0&&document.getElementById('game').style.display!=='none');
    await page.waitForFunction(expected=>document.getElementById('sceneNote').innerText.indexOf(expected)>=0,count===8?'Twos: fill groups':'Twos: high');
    assert.match(await page.locator('#activeRules').innerText(),count===8?/Two jokers added/:/No jokers/);
    assert.match(await page.locator('#activeRules').innerText(),count===8?/One lap per pile/:/Continuous laps/);
    let photographed=false;
    for(let rounds=0;rounds<3;){
      await page.waitForFunction(()=>!document.getElementById('suggest').disabled||document.getElementById('next').style.display!=='none'||!document.getElementById('pass').disabled||document.getElementById('handTitle').innerText==='CHOOSE YOUR RETURN',{},{timeout:20000});
      assert.equal(await page.locator('.seat').count(),count);
      if(await page.locator('#next').isVisible()){
        await page.screenshot({path:'artifacts/round-result-'+count+'.png',fullPage:true});
        rounds++;if(rounds===3)break;await clickPost('#next');continue;
      }
      if(await page.locator('#play').innerText()==='Return 2 card(s)'||await page.locator('#play').innerText()==='Return 1 card(s)'){
        const n=(await page.locator('#play').innerText()).indexOf('2')>=0?2:1;
        await page.locator('#hand button').nth(0).click();if(n===2)await page.locator('#hand button').nth(1).click();await clickPost('#play');continue;
      }
      if(await page.locator('#suggest').isEnabled()){
        await page.locator('#suggest').click();
        assert.ok(await page.locator('#hand .selected').count());
        if(rounds===0&&!photographed){
          const width=await page.evaluate(()=>document.documentElement.scrollWidth);assert.ok(width<=800,'must fit 800-wide screen');
          const bar=await page.locator('.actionbar').boundingBox();assert.ok(bar.y+bar.height<=600,'all play controls fit at 800x600');
          await page.screenshot({path:'artifacts/table-'+count+'-800x600.png',fullPage:true});
          photographed=true;
        }
        await clickPost('#play');
      }else await clickPost('#pass');
    }
    await page.locator('#view').click();assert.match(await page.locator('#scene').getAttribute('class'),/classic/);await page.locator('#view').click();
    await page.evaluate(()=>Island.panel('saves'));await clickPost('#saveButton');
    await page.waitForFunction(()=>/^[a-f0-9]{36}$/.test(document.getElementById('snapshot').value));
    const snapshot=await page.locator('#snapshot').inputValue();await page.locator('#loadCode').fill(snapshot);await clickPost('input[value="Load table"]');
    await page.waitForFunction(()=>document.getElementById('message').className==='message');
    assert.match(await page.locator('#activeRules').innerText(),count===8?/Twos fill groups/:/Twos are ordinary highest/);
    assert.match(await page.locator('#activeRules').innerText(),count===8?/One lap per pile/:/Continuous laps/);
    await page.evaluate(()=>Island.panel('saves'));
  }
  // Exercise the IE6 ActiveX branch by disabling the standard constructor.
  const legacy=await browser.newPage({viewport:{width:800,height:600}});
  await legacy.addInitScript(()=>{const Native=window.XMLHttpRequest;window.XMLHttpRequest=undefined;window.ActiveXObject=function(name){if(name!=='Microsoft.XMLHTTP')throw new Error('Unexpected ActiveX');return new Native();};});
  await legacy.goto('http://127.0.0.1:'+server.address().port+'/');await legacy.locator('#start').click();
  await legacy.waitForFunction(()=>document.querySelectorAll('.seat').length===6);assert.equal(await legacy.locator('.message.error').count(),0);
  // A model fixture exercises bot President -> human VP exchange UI and pumping.
  const exchangeRequests=[];
  modelProvider=http.createServer(async(req,res)=>{
    let raw='';for await(const c of req)raw+=c;const s=JSON.parse(JSON.parse(raw).messages[1].content);
    if(s.task==='exchange')exchangeRequests.push(s.seat);
    await new Promise(r=>setTimeout(r,s.task==='exchange'?200:1));
    const d=s.task==='exchange'?{cards:s.ownCards.slice(-s.returnCount),memory:'Preserve useful groups.'}:{move:s.legalMoves.length?0:-1,say:'Still a good evening.',memory:'Read the public play.'};
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(d)}}]}));
  });modelProvider.listen(0,'127.0.0.1');await once(modelProvider,'listening');
  modelApp=createApp({mode:'api',url:'http://127.0.0.1:'+modelProvider.address().port,model:'fixture',apiFormat:'chat',timeout:2000},{saveDir:temp,turnDelay:0,jokerDelay:0});modelApp.listen(0,'127.0.0.1');await once(modelApp,'listening');
  const exchangeGame=createGame('River',5);exchangeGame.phase='complete';exchangeGame.order=[1,0,2,3,4];nextRound(exchangeGame,{deferExchange:true});
  const exchangeCode='b'.repeat(36);await saveStore(temp).write(exchangeCode,{version:1,game:exchangeGame});
  const aiPage=await browser.newPage({viewport:{width:800,height:600}});aiPage.on('pageerror',e=>errors.push(e.message));
  await aiPage.addInitScript(()=>{const later=window.setTimeout;window.setTimeout=function(fn,ms){return later(fn,ms===700?25:ms);};});
  await aiPage.goto('http://127.0.0.1:'+modelApp.address().port+'/');await aiPage.evaluate(()=>Island.panel('saves'));
  await aiPage.locator('#loadCode').fill(exchangeCode);await clickPost('input[value="Load table"]',aiPage);
  await aiPage.waitForFunction(()=>document.getElementById('handTitle').innerText==='CHOOSE YOUR RETURN');
  assert.equal(await aiPage.locator('#play').innerText(),'Return 1 card(s)');
  await aiPage.screenshot({path:'artifacts/model-exchange-800x600.png',fullPage:true});
  await aiPage.locator('#hand button').last().click();await clickPost('#play',aiPage);
  await aiPage.waitForFunction(()=>document.getElementById('handTitle').innerText==='YOUR HAND'&&(!document.getElementById('suggest').disabled||!document.getElementById('pass').disabled));
  assert.deepEqual(exchangeRequests,[1]);assert.equal(await aiPage.locator('.message.error').count(),0);
  assert.deepEqual(errors,[]);await writeFile('artifacts/browser-check.json',JSON.stringify({passed:true,viewport:'800x600',seats:[5,8],roundsPerTable:3,activeXShim:true,modelExchange:true,errors},null,2));
  console.log('Browser check passed: 5/8 seats, 6 rounds, model exchange, saves, views, layout and ActiveX fallback.');
}finally{
  if(browser)await browser.close();
  if(modelApp){modelApp.closeAllConnections();await new Promise(r=>modelApp.close(r));}
  if(modelProvider){modelProvider.closeAllConnections();await new Promise(r=>modelProvider.close(r));}
  server.closeAllConnections();await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true});
}
