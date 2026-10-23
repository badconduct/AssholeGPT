import {chromium} from 'playwright';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {createApp,stateXml} from '../server.js';
import {createGame} from '../lib/game.js';
import {role} from '../lib/characters.js';
const app=createApp({mode:'local'});app.listen(0,'127.0.0.1');await once(app,'listening');
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const g=createGame('You',8);g.actor=0;g.opening=false;
  const scores=[12345,-37,0,1,2,-1,-200,9007199254740990];g.players.forEach((p,i)=>{p.score=scores[i];p.role=role(i,g.players.length);});
  await page.route('**/api/**',route=>route.fulfill({contentType:'text/xml',body:stateXml({game:g,mode:'local',csrf:'test',code:'a'.repeat(36)})}));
  await page.goto('http://127.0.0.1:'+app.address().port);await page.evaluate(()=>Island.resume());
  await page.waitForSelector('#seats .seatcaps');
  assert.equal(await page.locator('#seats .cap-total').first().innerText(),'+12.3k');
  assert.equal(await page.locator('#seats .cap-total').nth(1).innerText(),'-37');
  const stacks=await page.locator('#seats .cap-stack').evaluateAll(nodes=>nodes.map(n=>n.children.length));
  assert.deepEqual(stacks,[3,3,0,1,2,1,3,3]);
  for(const [index,side] of [[0,'up'],[1,'down']]){
    const img=page.locator('#seats .seatcaps').nth(index).locator('img').first();
    assert.match(await img.getAttribute('src'),new RegExp('-'+side+'\\.gif$'));
    await img.evaluate(n=>n.decode());assert.equal(await img.evaluate(n=>n.naturalWidth),20);
  }
  assert.match(await page.locator('#seats .cap-score').last().getAttribute('title'),/9007199254740990 bottle caps/);
  const seats=await page.locator('#seats').boundingBox(),caption=await page.locator('.pile-caption').boundingBox();
  await page.screenshot({path:'artifacts/bottle-caps-800x600.png',fullPage:true});
  assert.ok(seats.y+seats.height<=caption.y,'cap rows must not overlap the pile caption: '+JSON.stringify({seats,caption}));
  const actions=await page.locator('.actionbar').boundingBox();assert.ok(actions.y+actions.height<=600);
  await page.screenshot({path:'artifacts/bottle-caps-800x600.png',fullPage:true});
  await page.evaluate(()=>Island.panel('scores'));
  assert.match(await page.locator('#scoreTable').innerText(),/Vice Asshole -1/);
  assert.equal(await page.locator('#scoreTable .cap-total').first().innerText(),'+12345');
  assert.equal(await page.locator('#scoreTable .cap-total').last().innerText(),'+9007199254740990');
  assert.deepEqual(errors,[]);console.log('Bottle-cap browser check passed: signs, art, capped stacks, exact totals and eight-seat layout.');
}finally{if(browser)await browser.close();app.closeAllConnections();await new Promise(r=>app.close(r));}
