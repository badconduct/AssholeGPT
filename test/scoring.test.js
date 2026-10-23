import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,act,legalMoves,nextRound,exchangeCards,validateGame} from '../lib/game.js';
import {stateXml} from '../server.js';

function finish(g){
  for(let n=0;g.phase==='playing';n++){
    assert.ok(n<2000);act(g,g.actor,legalMoves(g)[0]||[]);
  }
}
test('every table size awards +2/+1/0/-1/-2 exactly once per completed deal and saves cumulative totals',()=>{
  for(let count=5;count<=8;count++){
    let g=createGame('Camper',count);const totals=Array(count).fill(0);
    for(let round=1;round<=3;round++){
      finish(g);
      g.order.forEach((seat,pos)=>{totals[seat]+=pos===0?2:pos===1?1:pos===count-1?-2:pos===count-2?-1:0;});
      assert.deepEqual(g.players.map(p=>p.score),totals);assert.equal(totals.reduce((a,b)=>a+b,0),0);
      g=validateGame(JSON.parse(JSON.stringify(g)));assert.deepEqual(g.players.map(p=>p.score),totals);
      if(round<3){nextRound(g);if(g.phase==='exchange')exchangeCards(g,g.players[0].cards.slice(0,g.exchange.pairs.find(p=>p.high===0).count));}
    }
    assert.ok(createGame('Camper',count).players.every(p=>p.score===0));
  }
});
test('legacy score migration preserves old totals and game state without rescoring a completed deal',()=>{
  for(const completed of [false,true]){
    const g=createGame();if(completed)finish(g);
    delete g.scoreVersion;delete g.scoreStartRound;g.players.forEach((p,i)=>p.score=20+i);
    const cards=g.players.map(p=>p.cards.slice()),wins=g.players.map(p=>p.wins),actor=g.actor,order=g.order.slice();
    validateGame(g);
    assert.deepEqual(g.players.map(p=>p.legacyScore),[20,21,22,23,24,25]);assert.ok(g.players.every(p=>p.score===0));
    assert.deepEqual(g.players.map(p=>p.cards),cards);assert.deepEqual(g.players.map(p=>p.wins),wins);assert.equal(g.actor,actor);assert.deepEqual(g.order,order);
    assert.equal(g.scoreStartRound,completed?2:1);const revision=g.revision;validateGame(g);assert.equal(g.revision,revision);
    if(!completed){finish(g);assert.equal(g.players[g.order[0]].score,2);assert.equal(g.players[g.order.at(-1)].score,-2);}
  }
});
test('negative and large cap scores survive serialization; future versions and corrupt scores are rejected',()=>{
  const g=createGame();g.players[0].score=-1234567890123;
  const saved=validateGame(JSON.parse(JSON.stringify(g)));assert.equal(saved.players[0].score,-1234567890123);
  assert.match(stateXml({game:saved,csrf:'fixture',mode:'local'}),/score="-1234567890123"/);
  saved.scoreVersion=3;assert.throws(()=>validateGame(saved),/saved scores/);saved.scoreVersion=2;
  saved.players[0].score=Infinity;assert.throws(()=>validateGame(saved),/saved scores/);
});
