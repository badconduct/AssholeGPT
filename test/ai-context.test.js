import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, act, nextRound, returnExchange, legalMoves, validateGame, sortCards } from '../lib/game.js';
import { contextFor, exchangeContextFor, exchangeDecision } from '../lib/ai.js';
import { publicKnowledge } from '../lib/observations.js';
import { saveStore } from '../lib/save-store.js';
import { createApp } from '../server.js';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function arrange(g,seat,wanted){
  for(const c of wanted){
    if(g.players[seat].cards.includes(c))continue;
    const donor=g.players.findIndex(p=>p.cards.includes(c)),replacement=g.players[seat].cards.find(card=>!wanted.includes(card));
    const i=g.players[seat].cards.indexOf(replacement),j=g.players[donor].cards.indexOf(c);
    g.players[seat].cards[i]=c;g.players[donor].cards[j]=replacement;
  }
  g.players.forEach(p=>sortCards(p.cards));
}
function exchangeTable(){
  const g=createGame('You',5,{matching:true,twos:'wild',jokers:true});
  g.phase='complete';g.order=[1,2,3,4,0];nextRound(g,{deferExchange:true});arrange(g,2,['3c','3d','4c']);return g;
}
test('models see the first play, ordered responses, winning seat and exact public card counts',()=>{
  const g=createGame('You',5,{matching:true});g.opening=false;g.actor=0;
  const hands=[['8c','3c'],['8d','4c'],['9c','5c'],['6c','6d'],['7c','7d']];g.players.forEach((p,i)=>p.cards=hands[i]);
  act(g,0,['8c']);act(g,1,['8d']);act(g,2,['9c']);act(g,3,[]);
  const s=JSON.parse(contextFor(g,4).user);
  assert.deepEqual(s.firstPlayOfRound.cards,['8c']);assert.equal(s.currentTrick.winningSeat,2);
  assert.deepEqual(s.currentTrick.orderedActions.map(e=>[e.seat,e.action]),[[0,'play'],[1,'play'],[2,'play'],[3,'pass']]);
  assert.equal(s.currentTrick.orderedActions[1].matched,true);
  assert.deepEqual(s.cardTracking.playedCards,['8c','8d','9c']);assert.equal(s.cardTracking.byRank['8'].played,2);assert.equal(s.cardTracking.byRank['8'].unseen,2);
  assert.equal(s.cardTracking.byRank['7'].inOwnHand,2);assert.equal(s.cardTracking.byRank.jokers.unseen,0);
  // Truncating the presentation log must not lose the AI's structured round ledger.
  g.history=[];assert.deepEqual(JSON.parse(contextFor(g,4).user).roundTimeline,s.roundTimeline);
  act(g,4,[]);act(g,0,[]);act(g,1,[]);
  const after=publicKnowledge(g,2);assert.equal(after.currentTrick.number,2);assert.equal(after.currentTrick.firstPlay,null);assert.deepEqual(after.firstPlayOfRound.cards,['8c']);assert.equal(after.roundTimeline.at(-1).action,'clear');
});
test('card tracking excludes hidden hands and other seats exchange information and resets next round',()=>{
  const g=createGame('You',6,{jokers:true});
  g.players[0].exchangeKnowledge=[{cards:['HUMAN PRIVATE']}];g.players[1].exchangeKnowledge=[{cards:['OWN TRANSFER']}];g.players[2].exchangeKnowledge=[{cards:['OTHER PRIVATE']}];
  const c=contextFor(g,1),s=JSON.parse(c.user);
  assert.ok(c.user.includes('OWN TRANSFER'));assert.ok(!c.user.includes('HUMAN PRIVATE'));assert.ok(!c.user.includes('OTHER PRIVATE'));assert.ok(s.players.every(p=>!p.cards&&!p.exchangeKnowledge));
  for(const rank of Object.keys(s.cardTracking.byRank)){const n=s.cardTracking.byRank[rank];assert.equal(n.played+n.inOwnHand+n.unseen,rank==='jokers'?2:4);}
  act(g,g.actor,legalMoves(g)[0]);assert.ok(g.roundEvents.length);
  g.phase='complete';g.order=[0,1,2,3,4,5];nextRound(g);
  assert.deepEqual(g.roundEvents,[]);assert.deepEqual(g.played,[]);assert.equal(g.trick,1);
});
test('legacy saves recover available ordered public history and explicitly mark missing order',()=>{
  const g=createGame();act(g,g.actor,legalMoves(g)[0]);
  delete g.roundEvents;delete g.trick;delete g.timelineComplete;validateGame(g);
  assert.equal(g.timelineComplete,true);assert.ok(g.roundEvents.some(e=>e.cards.includes('3c')));
  delete g.roundEvents;delete g.trick;delete g.timelineComplete;g.history=[];validateGame(g);
  const s=publicKnowledge(g,1);assert.equal(s.roundTimelineComplete,false);assert.equal(s.firstPlayOfRound,null);assert.ok(s.cardTracking.playedCards.includes('3c'));
});
test('pending exchange uses original cards and independent choices, with gifts withheld until both commit',()=>{
  const g=exchangeTable(),original=g.players.map(p=>p.cards.slice());
  g.players[1].memory=['PRESIDENT PRIVATE'];g.players[2].memory=['VP PRIVATE'];
  const presidentContext=JSON.parse(exchangeContextFor(g,1).user);assert.equal(presidentContext.returnCount,2);assert.deepEqual(presidentContext.ownCards,original[1]);assert.ok(!JSON.stringify(presidentContext).includes('VP PRIVATE'));
  const chosen=original[1].slice(-2);returnExchange(g,1,chosen);assert.equal(g.actor,2);
  assert.deepEqual(g.players.map(p=>p.cards),original,'nobody receives cards before both return choices');
  const context=exchangeContextFor(g,2),vp=JSON.parse(context.user);assert.equal(vp.returnCount,1);assert.ok(context.system.includes('pair of threes'));
  assert.ok(!context.user.includes('PRESIDENT PRIVATE'));assert.ok(vp.players.every(p=>!p.cards));
  returnExchange(g,2,['4c']);validateGame(g);
  assert.equal(g.phase,'playing');assert.equal(g.actor,0);assert.ok(g.players[2].cards.includes('3c')&&g.players[2].cards.includes('3d'));assert.ok(g.players[4].cards.includes('4c'));
  for(const card of chosen)assert.ok(g.players[0].cards.includes(card));
});
test('model exchange failure pauses VP, persists President choice and Retry does not repeat it',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'island-exchange-')),store=saveStore(dir),g=exchangeTable(),code='a'.repeat(36),requests=[];let failVP=true;
  const api=http.createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;const s=JSON.parse(JSON.parse(raw).messages[1].content);requests.push({seat:s.seat,task:s.task});
    const d={cards:s.seat===2?(failVP?['not-a-card']:['4c']):s.ownCards.slice(-s.returnCount),memory:'Keep useful matching groups.'};
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(d)}}]}));
  });api.listen(0,'127.0.0.1');await once(api,'listening');
  const config={mode:'api',url:'http://127.0.0.1:'+api.address().port,model:'fixture',apiFormat:'chat',timeout:2000};
  const server=createApp(config,{saveDir:dir,turnDelay:0,jokerDelay:0});server.listen(0,'127.0.0.1');await once(server,'listening');
  let cookie='',csrf='',xml='';const field=k=>new RegExp(' '+k+'="([^"]*)"').exec(xml)?.[1];
  async function request(path,data){
    const r=await fetch('http://127.0.0.1:'+server.address().port+path,{method:data?'POST':'GET',headers:{Cookie:cookie,...(data?{'X-CSRF':csrf}:{})},...(data?{body:new URLSearchParams(data)}:{})});
    if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];xml=await r.text();csrf=field('csrf')||csrf;assert.equal(r.status,200);
  }
  async function idle(){for(let n=0;n<300;n++){await request('/api/state');if(field('busy')==='0')return;await new Promise(r=>setTimeout(r,5));}throw new Error('Exchange stalled.');}
  try{
    await store.write(code,{version:1,game:g});await request('/api/state');await request('/api/load',{code});await idle();
    assert.equal(field('phase'),'exchange');assert.equal(field('actor'),'2');assert.equal(field('paused'),'1');
    const saved=await store.read(field('recovery'));assert.ok(saved.game.exchange.returns[1]);assert.equal(saved.game.exchange.returns[2],undefined);
    assert.deepEqual(saved.game.players[2].cards,g.players[2].cards);
    failVP=false;await request('/api/retry',{revision:field('revision')});await idle();
    assert.equal(field('phase'),'playing');assert.equal(field('actor'),'0');assert.equal(field('paused'),'0');
    assert.deepEqual(requests,[{seat:1,task:'exchange'},{seat:2,task:'exchange'},{seat:2,task:'exchange'}]);
    const final=await store.read(field('recovery'));validateGame(final.game);assert.ok(final.game.players[2].cards.includes('3c'));assert.ok(final.game.players[2].cards.includes('3d'));assert.ok(final.game.players[4].cards.includes('4c'));
    assert.ok(!xml.includes('Keep useful matching groups.'));
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));api.closeAllConnections();await new Promise(r=>api.close(r));await rm(dir,{recursive:true,force:true});}
});
