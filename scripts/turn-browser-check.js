import { chromium } from 'playwright';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { createApp, stateXml } from '../server.js';
import { createGame, nextRound } from '../lib/game.js';

const server=createApp({mode:'local'},{turnDelay:0,jokerDelay:0});server.listen(0,'127.0.0.1');await once(server,'listening');
const url='http://127.0.0.1:'+server.address().port;let browser;
let game=createGame('You',5,{matching:true,twos:'wild',jokers:true});game.opening=false;game.actor=0;
// Public UI fixture: the hand always contains both illustrated joker variants.
game.players[0].cards=['3c','4c','Xr','Xb'];
let heldPost=null,posts=0;
const xml=()=>stateXml({csrf:'test-csrf',game,mode:'local',code:'e'.repeat(36)});
try{
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
    if(route.request().method()==='POST'){posts++;heldPost=route;return;}
    await route.fulfill({contentType:'text/xml',body:xml()});
  });
  await page.goto(url);await page.evaluate(()=>Island.resume());
  await page.waitForFunction(()=>document.querySelectorAll('#hand button').length===4&&!document.getElementById('suggest').disabled);
  const jokerSources=[];
  for(const title of ['Red joker','Black joker']){
    const button=page.locator('#hand button[title="'+title+'"]');assert.equal(await button.innerText(),'');
    assert.equal(await button.locator('img').count(),1);assert.equal(await button.locator('img').evaluate(n=>n.complete&&n.naturalWidth===120),true);
    jokerSources.push(await button.locator('img').getAttribute('src'));
  }
  assert.notEqual(jokerSources[0],jokerSources[1]);assert.match(jokerSources[0],/joker-red-icon\.jpg$/);assert.match(jokerSources[1],/joker-black-icon\.jpg$/);
  const cardBoxes=await page.locator('#hand button').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return [b.width,b.height,getComputedStyle(n).borderColor];}));
  assert.ok(cardBoxes.every(b=>JSON.stringify(b)===JSON.stringify(cardBoxes[0])),'Jokers match ordinary card dimensions and borders');
  await page.locator('#hand button[title="Red joker"]').click();
  assert.match(await page.locator('#hand button[title="Red joker"] img').getAttribute('src'),/-selected\.jpg$/);
  await page.locator('#clear').click();
  await page.screenshot({path:'artifacts/joker-faces-800x600.png',fullPage:true});
  async function refresh(){game.revision++;const response=page.waitForResponse(r=>r.url().endsWith('/api/state'));await page.evaluate(()=>Island.resume());await response;}
  async function locked(){
    await page.waitForFunction(()=>document.getElementById('play').disabled&&Array.prototype.every.call(document.querySelectorAll('#hand button'),n=>n.disabled));
    assert.match(await page.locator('#play').getAttribute('class'),/inactive/);
    const before=posts;await page.evaluate(()=>{Island.select('Xr');Island.suggest();Island.play();Island.pass();var b=document.getElementById('hand').getElementsByTagName('button')[0];b.click();b.onclick();});
    assert.equal(posts,before);assert.equal(await page.locator('#hand .selected').count(),0);
  }
  game.actor=1;game.busy=true;await refresh();await locked();
  for(const image of await page.locator('#hand .joker-face').all())assert.match(await image.getAttribute('src'),/-inactive\.jpg$/);
  await page.screenshot({path:'artifacts/joker-disabled-800x600.png',fullPage:true});
  game.actor=0;game.busy=false;game.error='Provider paused.';await refresh();await locked();
  game.error='';game.revealUntil=Date.now()+3000;await refresh();await locked();
  game.revealUntil=0;await refresh();await page.waitForFunction(()=>!document.getElementById('suggest').disabled);
  await page.locator('#hand button[title="3 of clubs"]').click();assert.equal(await page.locator('#hand .selected').count(),1);assert.equal(await page.locator('#play').isEnabled(),true);
  await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('play').disabled);
  assert.equal(posts,1);assert.equal(await page.locator('#hand button:enabled').count(),0);
  for(const image of await page.locator('#hand .joker-face').all())assert.match(await image.getAttribute('src'),/-inactive\.jpg$/);
  await page.evaluate(()=>{Island.select('4c');Island.suggest();Island.play();});assert.equal(posts,1);assert.equal(await page.locator('#hand .selected').count(),1);
  await heldPost.fulfill({contentType:'text/xml',body:xml()});heldPost=null;
  await page.waitForFunction(()=>!document.getElementById('play').disabled);
  game.phase='complete';game.actor=-1;game.order=[0,1,2,3,4];await refresh();await locked();
  nextRound(game,{deferExchange:true});await refresh();
  await page.waitForFunction(()=>document.getElementById('handTitle').innerText==='CHOOSE YOUR RETURN'&&document.querySelector('#hand button').disabled===false);
  await page.locator('#hand button').first().click();assert.equal(await page.locator('#play').isEnabled(),true);
  game.phase='playing';game.actor=1;game.busy=true;game.forfeits=[0];game.players[0].cards=['Xr'];game.players[0].role='Asshole';
  await refresh();await locked();
  assert.equal(await page.locator('#seats .seataction').first().innerText(),'Joker forfeit');
  assert.equal(await page.locator('#seats .seatrole').first().innerText(),'Asshole');
  assert.deepEqual(errors,[]);console.log('Turn browser check passed: wordless Joker images; own-turn/exchange selection; opponent, paused, reveal, completed and pending locks.');
}finally{if(heldPost)await heldPost.abort();if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
