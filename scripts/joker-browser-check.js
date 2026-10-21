import { chromium } from 'playwright';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { createApp } from '../server.js';
import { createGame, validateGame, sortCards } from '../lib/game.js';
import { saveStore } from '../lib/save-store.js';

function fixture(seat){
  const g=createGame('You',5,{matching:true,twos:'wild',jokers:true});
  for(const card of ['Xr','4c']){
    if(g.players[seat].cards.includes(card))continue;
    const donor=g.players.findIndex(p=>p.cards.includes(card)),other=g.players[seat].cards.find(c=>!['Xr','4c'].includes(c));
    g.players[donor].cards[g.players[donor].cards.indexOf(card)]=other;g.players[seat].cards[g.players[seat].cards.indexOf(other)]=card;
  }
  const aces=['Ac','Ad','Ah'];
  g.players.forEach(p=>{p.cards=sortCards(p.cards.filter(c=>!aces.includes(c)));});
  if(seat!==0){const excess=g.players[seat].cards.filter(c=>!['Xr','4c'].includes(c));g.players[seat].cards=['4c','Xr'];g.players[3].cards.push(...excess);}
  g.opening=false;g.actor=seat;g.last=4;g.played=aces;g.pile={seat:4,cards:aces.slice()};g.passed=[];g.roundEvents=[];
  validateGame(g);return g;
}
const temp=await mkdtemp(join(tmpdir(),'island-joker-ui-')),store=saveStore(temp);
const server=createApp({mode:'local'},{saveDir:temp,turnDelay:5,jokerDelay:1800});server.listen(0,'127.0.0.1');await once(server,'listening');
const url='http://127.0.0.1:'+server.address().port;let browser;
const field=(xml,k)=>new RegExp(' '+k+'="([^"]*)"').exec(xml)?.[1];
try{
  await store.write('c'.repeat(36),{version:1,game:fixture(0)});await store.write('d'.repeat(36),{version:1,game:fixture(2)});
  await mkdir('artifacts',{recursive:true});browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.evaluate(()=>Island.panel('saves'));await page.locator('#loadCode').fill('c'.repeat(36));await page.locator('input[value="Load table"]').click();
  await page.waitForFunction(()=>!document.getElementById('suggest').disabled);await page.evaluate(()=>Island.panel('saves'));
  await page.locator('#hand button[title="Red joker"]').click();await page.locator('#play').click();
  await page.waitForFunction(()=>document.getElementById('jokerFlash').style.display!=='none');
  assert.match(await page.locator('#jokerArt').getAttribute('src'),/joker-red-icon\.jpg$/);
  assert.match(await page.locator('#jokerWinner').innerText(),/You win the pile/);assert.equal(await page.locator('#play').isDisabled(),true);assert.equal(await page.locator('#pass').isDisabled(),true);
  await page.screenshot({path:'artifacts/joker-800x600.png',fullPage:true});
  let xml=await page.request.get(url+'/api/state').then(r=>r.text());const revision=field(xml,'revision');assert.ok(Number(field(xml,'revealMs'))>0);assert.equal(field(xml,'actor'),'0');
  const blocked=await page.request.post(url+'/api/action',{form:{revision,cards:'4c'},headers:{'X-CSRF':field(xml,'csrf')}});assert.equal(blocked.status(),400);
  // Snapshots preserve the win but never replay an elapsed presentation cue.
  const snapshot=await page.request.post(url+'/api/save',{form:{},headers:{'X-CSRF':field(xml,'csrf')}}).then(r=>r.text());const snapshotCode=field(snapshot,'save');
  await page.waitForFunction(()=>document.getElementById('jokerFlash').style.display==='none'&&!document.getElementById('suggest').disabled);
  assert.match(await page.locator('#sceneNote').innerText(),/You win the pile/);
  xml=await page.request.get(url+'/api/state').then(r=>r.text());assert.equal(field(xml,'revision'),revision);
  await page.request.post(url+'/api/load',{form:{code:snapshotCode},headers:{'X-CSRF':field(xml,'csrf')}});
  xml=await page.request.get(url+'/api/state').then(r=>r.text());assert.equal(field(xml,'revealMs'),'0');assert.match(xml,/<trickResult[^>]*joker="1"/);
  // Bot jokers must also remain visible while the server waits before its next lead.
  await page.locator('button').filter({hasText:/^Save \/ Load$/}).click();await page.locator('#loadCode').fill('d'.repeat(36));await page.locator('input[value="Load table"]').click();
  await page.waitForFunction(()=>document.getElementById('jokerFlash').style.display!=='none'&&document.getElementById('jokerWinner').innerText.indexOf('Owen')>=0);
  xml=await page.request.get(url+'/api/state').then(r=>r.text());const botRevision=field(xml,'revision');assert.equal(field(xml,'actor'),'2');
  await page.waitForTimeout(150);xml=await page.request.get(url+'/api/state').then(r=>r.text());assert.equal(field(xml,'revision'),botRevision);assert.ok(Number(field(xml,'revealMs'))>0);
  assert.deepEqual(errors,[]);console.log('Joker browser check passed: human/bot overlays, pause, winner lead, blocked counterplay and save deduplication.');
}finally{
  if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));
  if(dirname(resolve(temp))===resolve(tmpdir())&&basename(temp).startsWith('island-joker-ui-'))await rm(temp,{recursive:true,force:true});
}
