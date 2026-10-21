import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';
import { createGame, act, nextRound, exchangeCards, legalMoves, validateGame, sortCards, ranks } from '../lib/game.js';
import { contextFor, localDecision, decision, configuration } from '../lib/ai.js';
import { stateXml } from '../server.js';

function conserved(g){
  const cards=[...g.played,...g.players.flatMap(p=>p.cards)];assert.equal(cards.length,52);assert.equal(new Set(cards).size,52);validateGame(g);
}
function playRound(g){
  for(let turns=0;g.phase==='playing';turns++){
    assert.ok(turns<1500,'round must terminate');
    const choices=legalMoves(g),i=g.actor;
    // Alternate good and deliberately weaker choices to exercise different endings.
    const move=choices.length?choices[(turns+g.round)%choices.length]:[];
    act(g,i,move);conserved(g);
  }
}
test('five through eight seats complete repeated rounds, conserve cards and cumulative points',()=>{
  for(let n=5;n<=8;n++){
    const g=createGame('Camper',n);
    for(let round=1;round<=25;round++){
      assert.equal(g.round,round);conserved(g);
      if(g.phase==='exchange'){const count=g.exchange.pairs.find(p=>p.high===0).count;exchangeCards(g,g.players[0].cards.slice(0,count));}
      playRound(g);assert.equal(g.order.length,n);assert.equal(new Set(g.order).size,n);
      assert.equal(g.players.reduce((s,p)=>s+p.score,0),round*n*(n-1)/2);
      assert.equal(g.players.reduce((s,p)=>s+p.wins,0),round);
      assert.equal(g.players[g.order[0]].role,'President');assert.equal(g.players[g.order[n-1]].role,'Asshole');
      if(round<25)nextRound(g);
    }
  }
});
test('opening requires 3c and server rejects malformed, stolen and wrong-size groups without mutation',()=>{
  const g=createGame('Camper'),i=g.actor;
  const before=JSON.stringify(g);
  for(const cards of [[],['2s'],['3c','3c'],['3c','4c'],['<script>']])assert.throws(()=>act(g,i,cards));
  assert.equal(JSON.stringify(g),before);
  act(g,i,['3c']);assert.equal(g.opening,false);
  const j=g.actor,p=g.players[j],bad=p.cards.slice(0,2);assert.throws(()=>act(g,j,bad));
  assert.throws(()=>act(g,i,['3c']));
});
function controlled(hands){
  const g=createGame('Camper',5);g.opening=false;g.pile=null;g.passed=[];g.order=[];g.last=-1;g.actor=0;
  g.players.forEach((p,i)=>p.cards=hands[i]);g.played=[];return g;
}
test('passes stay locked and a finished pile winner gives lead clockwise',()=>{
  const g=controlled([['3c'],['4c','5c'],['6c','7c'],['8c','9c'],['Tc','Jc']]);
  act(g,0,['3c']);assert.equal(g.order[0],0);
  act(g,1,[]);act(g,2,[]);act(g,3,[]);act(g,4,[]);
  assert.equal(g.pile,null);assert.equal(g.actor,1);assert.deepEqual(g.passed,[]);
  act(g,1,['4c']);act(g,2,[]);act(g,3,['8c']);act(g,4,[]);
  assert.equal(g.actor,1);assert.ok(g.passed.includes(2));
  act(g,1,[]);assert.equal(g.actor,3);assert.equal(g.pile,null);
});
test('equal rank is not enough, twos have no special clear, empty-table pass forbidden',()=>{
  const g=controlled([['Ac','Ad','3c'],['Ah','As','4c'],['2h','2s','5c'],['6c','6d'],['7c','7d']]);
  assert.throws(()=>act(g,0,[]));act(g,0,['Ac','Ad']);assert.throws(()=>act(g,1,['Ah','As']));act(g,1,[]);act(g,2,['2h','2s']);
  assert.ok(g.pile);assert.equal(g.actor,3);act(g,3,[]);act(g,4,[]);act(g,0,[]);assert.equal(g.pile,null);assert.equal(g.actor,2);
});
test('exchange uses original hands, allows choosing top-seat returns and preserves cards',()=>{
  const g=createGame('Camper',6);playRound(g);g.order=[0,1,2,3,4,5];
  nextRound(g);assert.equal(g.phase,'exchange');
  const original=g.players.map(p=>p.cards.slice()),gift=original[5].slice(-2),give=original[0].slice(0,2),viceGift=original[4].slice(-1),viceReturn=original[1].slice(0,1);
  assert.throws(()=>exchangeCards(g,[give[0]]));
  exchangeCards(g,give);conserved(g);assert.equal(g.actor,5);
  for(const c of gift)assert.ok(g.players[0].cards.includes(c));for(const c of give)assert.ok(g.players[5].cards.includes(c));
  for(const c of viceGift)assert.ok(g.players[1].cards.includes(c));for(const c of viceReturn)assert.ok(g.players[4].cards.includes(c));
});
test('President and VP may return their highest cards rather than their lowest',()=>{
  for(const position of [0,1]){
    const g=createGame('Camper',6);playRound(g);
    g.order=position===0?[0,1,2,3,4,5]:[1,0,2,3,4,5];
    nextRound(g);assert.equal(g.phase,'exchange');
    const count=position===0?2:1,recipient=position===0?5:4;
    const chosen=g.players[0].cards.slice(-count),lowest=g.players[0].cards[0];
    exchangeCards(g,chosen);conserved(g);
    assert.ok(g.players[0].cards.includes(lowest),'lowest card can be kept');
    for(const c of chosen){assert.ok(g.players[recipient].cards.includes(c));assert.ok(!g.players[0].cards.includes(c));}
  }
});
test('opponent context isolates cards, memories and human exchange information',()=>{
  const g=createGame('Camper',8);g.players[0].memory=['HUMAN SECRET'];g.players[2].memory=['OTHER SECRET'];g.players[1].memory=['OWN SECRET'];
  g.history.push({id:999,text:'PRIVATE EXCHANGE',privateToHuman:true});
  const c=contextFor(g,1),s=JSON.parse(c.user);
  assert.deepEqual(s.ownCards,g.players[1].cards);assert.ok(c.user.includes('OWN SECRET'));assert.ok(!c.user.includes('OTHER SECRET'));assert.ok(!c.user.includes('HUMAN SECRET'));assert.ok(!c.user.includes('PRIVATE EXCHANGE'));
  assert.ok(s.players.every(p=>!p.cards));
  const xml=stateXml({game:g,csrf:'x',mode:'local',code:'x'});
  assert.equal((xml.match(/<card>/g)||[]).length,g.players[0].cards.length);
});
test('local bots play complete games using only their own legal contexts',async()=>{
  const g=createGame('Camper',8),c=configuration({});
  for(let rounds=0;rounds<4;rounds++){
    let turns=0;
    while(g.phase==='playing'){
      assert.ok(turns++<2000);const seat=g.actor;
      if(seat===0)act(g,0,legalMoves(g)[0]||[]);
      else {const d=await decision(g,seat,c);act(g,seat,d.cards);}
      conserved(g);
    }
    if(rounds<3){nextRound(g);if(g.phase==='exchange')exchangeCards(g,g.players[0].cards.slice(0,g.exchange.pairs.find(p=>p.high===0).count));}
  }
});
test('legacy client parses as ES3 and has no modern rendering dependencies',async()=>{
  const source=await readFile(new URL('../public/client.js',import.meta.url),'utf8');parse(source,{ecmaVersion:3});
  assert.match(source,/Microsoft.XMLHTTP/);assert.doesNotMatch(source,/\b(fetch|JSON|Promise|querySelector|localStorage)\b/);
  const css=await readFile(new URL('../public/style.css',import.meta.url),'utf8');assert.doesNotMatch(css,/display:\s*(flex|grid)|rgba\(|transform:|var\(/);
});
test('invalid setup and corrupt saves rejected',()=>{
  for(const count of [4,9,5.5,NaN])assert.throws(()=>createGame('You',count));
  assert.throws(()=>createGame('bad\nname',6));assert.throws(()=>createGame('x'.repeat(25),6));
  const g=createGame();g.players[0].cards.push(g.players[1].cards[0]);assert.throws(()=>validateGame(g));
});
test('older empty-pile saves recover the public winner explanation without changing the lead',()=>{
  const g=createGame();
  while(!g.lastTrick)act(g,g.actor,legalMoves(g)[0]||[]);
  const expected={winner:g.lastTrick.winner,leader:g.actor};delete g.lastTrick;
  validateGame(g);assert.equal(g.lastTrick.winner,expected.winner);assert.equal(g.lastTrick.leader,expected.leader);assert.equal(g.actor,expected.leader);
});
