import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, act, validateGame } from '../lib/game.js';
import { normalizeRules, ruleDescriptions } from '../lib/rules.js';
import { contextFor } from '../lib/ai.js';

function table(pileMode,hands,actor=0){
  const g=createGame('You',5,{pileMode,matching:true,twos:'wild',jokers:true});g.opening=false;g.actor=actor;
  g.players.forEach((p,i)=>p.cards=hands[i].slice());return g;
}
test('one lap stops at the original lead while continuous laps give earlier players another response',()=>{
  const hands=[['8c','Qc'],['9c','Kc'],['Tc','Ac'],['Jc','2c'],['3c','4c']];
  for(const mode of ['single-lap','continuous']){
    const g=table(mode,hands);act(g,0,['8c']);act(g,1,['9c']);act(g,2,['Tc']);act(g,3,['Jc']);act(g,4,[]);
    if(mode==='single-lap'){assert.equal(g.pile,null);assert.equal(g.actor,3);assert.equal(g.lastTrick.winner,3);assert.equal(g.pileStart,null);}
    else {assert.ok(g.pile);assert.equal(g.actor,0);assert.equal(g.pileStart,0);act(g,0,['Qc']);assert.equal(g.last,0);}
  }
});
test('one-lap ties belong to the first highest player and do not extend the circuit',()=>{
  const g=table('single-lap',[['8c','3c'],['9c','4c'],['9d','5c'],['9h','6c'],['7c','7d']]);
  act(g,0,['8c']);act(g,1,['9c']);act(g,2,['9d']);act(g,3,['9h']);act(g,4,[]);
  assert.equal(g.pile,null);assert.equal(g.actor,1);assert.equal(g.lastTrick.winner,1);
  act(g,1,['4c']);assert.equal(g.pileStart,1);
});
test('the one-lap boundary remains the original lead after that player finishes',()=>{
  const g=table('single-lap',[['3c'],['4c','Qc'],['5c','Kc'],['6c','Ac'],['7c','Tc']]);
  act(g,0,['3c']);act(g,1,['4c']);act(g,2,['5c']);act(g,3,['6c']);act(g,4,['7c']);
  assert.equal(g.actor,4);assert.equal(g.pile,null);assert.equal(g.lastTrick.winner,4);assert.deepEqual(g.order,[0]);
});
test('a lap starting at the final seat wraps correctly without awarding a new response to earlier players',()=>{
  const g=table('single-lap',[['4c','Qc'],['5c','Kc'],['6c','Ac'],['7c','Tc'],['3c','3d']],4);
  act(g,4,['3c']);act(g,0,['4c']);act(g,1,['5c']);act(g,2,['6c']);act(g,3,['7c']);
  assert.equal(g.actor,3);assert.equal(g.pile,null);assert.equal(g.lastTrick.winner,3);
});
test('a finished one-lap winner passes the next lead clockwise, including a player who passed',()=>{
  const g=table('single-lap',[['8c','3c'],['9c'],['4c','4d'],['5c','5d'],['6c','6d']]);
  act(g,0,['8c']);act(g,1,['9c']);act(g,2,[]);act(g,3,[]);act(g,4,[]);
  assert.equal(g.lastTrick.winner,1);assert.equal(g.actor,2);assert.equal(g.pile,null);assert.deepEqual(g.passed,[]);
});
test('jokers still clear immediately with no counterplay in either turn style',()=>{
  for(const mode of ['single-lap','continuous']){
    const g=table(mode,[['Ac','Ad','3c'],['Xr','4c'],['Xb','5c'],['6c','6d'],['7c','7d']]);
    act(g,0,['Ac','Ad']);act(g,1,['Xr']);assert.equal(g.pile,null);assert.equal(g.actor,1);assert.equal(g.lastTrick.joker,true);assert.throws(()=>act(g,2,['Xb']));
  }
});
test('old rule objects default to continuous laps and the AI gets the selected turn style',()=>{
  assert.equal(normalizeRules({matching:true}).pileMode,'continuous');
  const g=createGame('You',5,{pileMode:'single-lap'}),c=contextFor(g,1);
  assert.equal(JSON.parse(c.user).rules.pileMode,'single-lap');assert.match(c.system,/One lap per pile/);assert.doesNotMatch(ruleDescriptions(g.rules).join(' '),/Continuous laps:/);
});
test('saving midway through a one-lap pile preserves its original lead and validates it',()=>{
  let g=createGame('You',5,{pileMode:'single-lap',matching:true});
  // First legal opening from the real deck; a valid mid-pile save keeps all 52 cards.
  const seat=g.actor;act(g,seat,['3c']);assert.equal(g.pileStart,seat);
  g=validateGame(JSON.parse(JSON.stringify(g)));assert.equal(g.pileStart,seat);assert.equal(g.rules.pileMode,'single-lap');
  g.pileStart=null;assert.throws(()=>validateGame(g),/Invalid saved pile lead/);
});
