import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, act, nextRound, exchangeCards, legalMoves, validateGame, combination } from '../lib/game.js';
import { normalizeRules, defaultRules } from '../lib/rules.js';
import { contextFor, decision } from '../lib/ai.js';

function table(hands,rules={}){
  const g=createGame('You',5,rules);g.opening=false;g.pile=null;g.passed=[];g.order=[];g.last=-1;g.actor=0;
  g.players.forEach((p,i)=>p.cards=hands[i]);g.played=[];return g;
}
function conservation(g){const cards=[...g.played,...g.players.flatMap(p=>p.cards)],size=g.rules.jokers?54:52;assert.equal(cards.length,size);assert.equal(new Set(cards).size,size);validateGame(g);}
test('matching equal singles and pairs is optional and does not skip anyone',()=>{
  const hands=[['7c','7d','3c'],['7h','7s','4c'],['8c','8d','5c'],['9c','9d'],['Tc','Td']];
  for(const matching of [false,true]){
    for(const pair of [false,true]){
      const g=table(hands.map(h=>h.slice()),{matching});act(g,0,pair?['7c','7d']:['7c']);
      const cards=pair?['7h','7s']:['7h'];
      if(matching){assert.ok(legalMoves(g).some(m=>m.join()===cards.join()));act(g,1,cards);assert.equal(g.actor,2);assert.equal(g.last,0);assert.equal(g.pile.seat,1);}
      else assert.throws(()=>act(g,1,cards));
    }
  }
});
test('first of three equal eights wins after the circuit, without requiring matchers to pass again',()=>{
  const g=table([['8c','3c'],['8d','4c'],['8h','5c'],['6c','6d'],['7c','7d']],{matching:true});
  act(g,0,['8c']);act(g,1,['8d']);act(g,2,['8h']);assert.equal(g.last,0);
  act(g,3,[]);act(g,4,[]);assert.equal(g.pile,null);assert.equal(g.actor,0);assert.deepEqual(g.passed,[]);
});
test('a higher play beats tied eights and starts a fresh circuit',()=>{
  const g=table([['8c','Tc','3c'],['8d','Td','4c'],['8h','5c'],['9c','6c'],['7c','7d']],{matching:true});
  act(g,0,['8c']);act(g,1,['8d']);act(g,2,['8h']);act(g,3,['9c']);assert.equal(g.last,3);
  act(g,4,[]);assert.equal(g.actor,0);act(g,0,['Tc']);assert.equal(g.last,0);
  act(g,1,['Td']);assert.equal(g.last,0);act(g,2,[]);act(g,3,[]);assert.equal(g.pile,null);assert.equal(g.actor,0);
});
test('equal pairs and wild-filled groups leave the first highest group winning',()=>{
  const g=table([['8c','8d','3c'],['8h','2d','4c'],['7c','7d'],['6c','6d'],['5c','5d']],{matching:true,twos:'wild'});
  act(g,0,['8c','8d']);act(g,1,['2d','8h']);assert.equal(g.last,0);
  act(g,2,[]);act(g,3,[]);act(g,4,[]);assert.equal(g.actor,0);assert.equal(g.pile,null);
});
test('a finished first equal player wins the pile and passes the lead clockwise',()=>{
  const g=table([['8c'],['8d','4c'],['8h','5c'],['6c','6d'],['7c','7d']],{matching:true});
  act(g,0,['8c']);act(g,1,['8d']);act(g,2,['8h']);act(g,3,[]);act(g,4,[]);
  assert.equal(g.pile,null);assert.equal(g.actor,1);assert.deepEqual(g.order,[0]);
});
test('a player who passed never takes a live winner\'s lead, but can inherit from a finished winner',()=>{
  const hands=[['3d','5h'],['Ah','4c'],['Qc','6c'],[],[],['Ad']];
  const g=createGame('You',6,{matching:true});g.opening=false;g.actor=5;g.order=[3,4];g.pile=null;g.passed=[];g.last=-1;
  g.players.forEach((p,i)=>p.cards=hands[i]);
  act(g,5,['Ad']);act(g,0,[]);act(g,1,['Ah']);act(g,2,[]);
  assert.equal(g.actor,0);assert.equal(g.pile,null);assert.equal(g.lastTrick.winner,5);assert.equal(g.lastTrick.leader,0);assert.deepEqual(g.order,[3,4,5]);
  // Same plays with a winner who still has cards must return to that winner.
  const h=createGame('You',6,{matching:true});h.opening=false;h.actor=5;h.order=[3,4];h.pile=null;h.passed=[];h.last=-1;
  h.players.forEach((p,i)=>p.cards=i===5?['Ad','7c']:hands[i].slice());
  act(h,5,['Ad']);act(h,0,[]);act(h,1,['Ah']);act(h,2,[]);
  assert.equal(h.actor,5);assert.equal(h.lastTrick.winner,5);assert.equal(h.lastTrick.leader,5);
});
test('a joker result identifies its winner, starts a fresh pile and rejects a counter-joker from another seat',()=>{
  const g=table([['Ac','Ad','3c'],['Xr','4c'],['Xb','5c'],['6c','6d'],['7c','7d']],{jokers:true});
  act(g,0,['Ac','Ad']);act(g,1,['Xr']);
  assert.equal(g.lastTrick.joker,true);assert.equal(g.lastTrick.winner,1);assert.equal(g.lastTrick.leader,1);assert.equal(g.actor,1);assert.equal(g.pile,null);
  assert.throws(()=>act(g,2,['Xb']),/Wait for your turn/);
  act(g,1,['4c']);assert.equal(g.pile.seat,1);assert.equal(g.pile.cards[0],'4c');
});
test('wild twos fill one natural rank, take its rank regardless of selection order and match pile size',()=>{
  const g=table([['6c','6d','6h','3c'],['7c','7d','2h','4c'],['8c','8d','2s','5c'],['9c','9d'],['Tc','Td']],{twos:'wild'});
  act(g,0,['6c','6d','6h']);assert.ok(legalMoves(g).some(m=>m.join()==='7c,7d,2h'));
  assert.throws(()=>act(g,1,['2h']));act(g,1,['2h','7c','7d']);assert.equal(combination(g.pile.cards,g.rules).rank,4);
  act(g,2,['8c','8d','2s']);assert.equal(g.last,2);
  assert.equal(combination(['7c','8c','2c'],{twos:'wild'}),null);
  assert.equal(combination(['7c','2c'],{twos:'high'}),null);
  assert.equal(combination(['2c','2d'],{twos:'wild'}).rank,12);
  assert.equal(combination(['7c','7d','7h','2c','2d'],{twos:'wild'}),null);
});
test('a wild two alone is highest, but is not implicitly a clear card',()=>{
  const g=table([['Ac','3c'],['2c','4c'],['2h','5c'],['6c','7c'],['8c','9c']],{twos:'wild',matching:true});
  act(g,0,['Ac']);act(g,1,['2c']);assert.ok(g.pile);assert.equal(g.actor,2);act(g,2,['2h']);assert.ok(g.pile);
});
test('jokers beat any pile alone, clear immediately and cannot combine with anything',()=>{
  for(const n of [1,2,3,4]){
    const g=table([['Ac','Ad','Ah','As','3c'],['Xr','4c'],['5c','5d'],['6c','6d'],['7c','7d']],{jokers:true,twos:'wild'});
    act(g,0,['Ac','Ad','Ah','As'].slice(0,n));
    assert.ok(legalMoves(g).some(m=>m[0]==='Xr'));assert.throws(()=>act(g,1,['Xr','4c']));act(g,1,['Xr']);
    assert.equal(g.pile,null);assert.equal(g.actor,1);assert.deepEqual(g.passed,[]);assert.ok(g.played.includes('Xr'));
  }
  assert.equal(combination(['Xr','Xb'],{jokers:true}),null);assert.equal(combination(['Xr'],{}),null);
});
test('a final Joker is illegal, and leaving only Jokers forfeits the lowest unclaimed rank',()=>{
  const g=table([['3c','Xb'],['4c','Xr'],['5c','5d'],['6c','6d'],['7c','7d']],{jokers:true});
  act(g,0,['3c']);assert.deepEqual(g.forfeits,[0]);assert.equal(g.players[0].role,'Asshole');assert.equal(g.actor,1);
  act(g,1,['4c']);assert.deepEqual(g.forfeits,[0,1]);assert.equal(g.players[1].role,'Vice Asshole');
  assert.equal(g.actor,2);assert.equal(g.phase,'playing');assert.deepEqual(g.order,[]);
  while(g.phase==='playing')act(g,g.actor,legalMoves(g)[0]||[]);
  assert.deepEqual(g.order.slice(-2),[1,0]);assert.equal(g.players[0].score,0);assert.equal(g.players[1].score,1);
  assert.equal(g.players.reduce((s,p)=>s+p.score,0),10);assert.deepEqual(g.players[0].cards,['Xb']);
  const lone=table([['Xr'],['4c','4d'],['5c','5d'],['6c','6d'],['7c','7d']],{jokers:true});
  assert.deepEqual(legalMoves(lone),[]);assert.throws(()=>act(lone,0,['Xr']),/cannot finish on a Joker/);
});

test('saved Joker-only hands forfeit once, retain the deck and reset on the next deal',()=>{
  for(const only of [['Xr'],['Xr','Xb']]){
    let g=createGame('You',5,{jokers:true});
    const deck=g.players.flatMap(p=>p.cards);g.opening=false;g.actor=0;
    g.players[0].cards=only.slice();g.players[1].cards=['3c'];
    for(let i=2;i<5;i++)g.players[i].cards=[];
    g.played=deck.filter(c=>!only.includes(c)&&c!=='3c');g.order=[2,3,4];
    g=validateGame(JSON.parse(JSON.stringify(g)));
    assert.equal(g.phase,'complete');assert.deepEqual(g.order,[2,3,4,1,0]);assert.deepEqual(g.forfeits,[0]);
    assert.equal(g.players[0].role,'Asshole');assert.deepEqual(g.players[0].cards,only);conservation(g);
    const scores=g.players.map(p=>p.score);validateGame(g);assert.deepEqual(g.players.map(p=>p.score),scores);
    nextRound(g);assert.deepEqual(g.forfeits,[]);assert.equal(g.actor,0);conservation(g);
  }
  const g=createGame('You',5,{jokers:true}),deck=g.players.flatMap(p=>p.cards);
  g.players.forEach(p=>p.cards=p.cards.filter(c=>c!=='Xr'));g.players[4].cards.push(...g.players[0].cards);g.players[0].cards=['Xr'];
  g.opening=false;g.actor=0;validateGame(g);
  assert.equal(g.phase,'playing');assert.equal(g.actor,1);assert.deepEqual(g.forfeits,[0]);
  assert.equal(g.players.flatMap(p=>p.cards).length,deck.length);
});
test('optional clearing twos remain distinct from wild group twos',()=>{
  for(const twos of ['clear','both']){
    const g=table([['Ac','Ad','3c'],['2c','4c'],['5c','5d'],['6c','6d'],['7c','7d']],{twos});act(g,0,['Ac','Ad']);act(g,1,['2c']);assert.equal(g.pile,null);assert.equal(g.actor,1);
  }
  assert.ok(combination(['7c','2c'],{twos:'both'}));assert.equal(combination(['7c','2c'],{twos:'clear'}),null);
});
test('first opening still includes 3c even with special cards',()=>{
  const g=createGame('You',5,{twos:'both',jokers:true}),seat=g.actor;
  assert.ok(legalMoves(g).every(m=>m.includes('3c')));assert.throws(()=>act(g,seat,['Xb']));
  const opening=legalMoves(g)[0];act(g,seat,opening);conservation(g);
});
test('every combination of house rules completes repeated games with conserved deck, scores and saved rules',async()=>{
  for(const pileMode of ['single-lap','continuous'])for(const matching of [false,true])for(const twos of ['high','wild','clear','both'])for(const jokers of [false,true])for(const count of [5,8]){
    const rules={matching,twos,jokers,pileMode};let g=createGame('You',count,rules);
    for(let round=1;round<=3;round++){
      let turns=0;conservation(g);
      while(g.phase==='playing'){
        assert.ok(turns++<2000,'round should finish');const seat=g.actor;
        if(seat===0){const moves=legalMoves(g);act(g,seat,moves[turns%moves.length]||[]);}
        else {const d=await decision(g,seat,{mode:'local'});act(g,seat,d.cards);}
        conservation(g);
      }
      assert.equal(g.players.reduce((s,p)=>s+p.score,0),round*count*(count-1)/2);
      g=validateGame(JSON.parse(JSON.stringify(g)));assert.deepEqual(g.rules,rules);
      if(round<3){nextRound(g);if(g.phase==='exchange')exchangeCards(g,g.players[0].cards.slice(0,g.exchange.pairs.find(p=>p.high===0).count));}
    }
  }
});
test('legacy saves migrate to original rules; mismatched decks and invalid rules are rejected',()=>{
  const old=createGame();delete old.rules;validateGame(old);assert.deepEqual(old.rules,defaultRules);
  const modern=createGame('You',6,{jokers:true});modern.rules.jokers=false;assert.throws(()=>validateGame(modern));
  for(const rules of [null,[],{matching:'yes'},{jokers:1},{twos:'anything'},{pileMode:'endless'},{unknown:true}])assert.throws(()=>normalizeRules(rules));
});
test('model instructions receive selected rules, without fixed classic contradictions',()=>{
  const g=createGame('You',6,{matching:true,twos:'wild',jokers:true});const c=contextFor(g,1),s=JSON.parse(c.user);
  assert.deepEqual(s.rules,g.rules);assert.match(c.system,/Matching allowed/);assert.match(c.system,/Twos fill groups/);assert.match(c.system,/joker alone to beat any pile/);assert.doesNotMatch(c.system,/strictly beating|No.*special clears/);
});
