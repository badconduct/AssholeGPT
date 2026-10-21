import { randomInt, randomBytes } from 'node:crypto';
import { friends, role } from './characters.js';
import { normalizeRules } from './rules.js';
import { initializeLedger, recordAction } from './observations.js';

export const ranks='3456789TJQKA2';
export const value=c=>c[0]==='X'?13:ranks.indexOf(c[0]);
export const sortCards=cards=>cards.sort((a,b)=>value(a)-value(b) || 'cdhs'.indexOf(a[1])-'cdhs'.indexOf(b[1]));
export function deck(rules={}) {
  const cards=[...'cdhs'].flatMap(s=>[...ranks].map(r=>r+s));
  if(normalizeRules(rules).jokers)cards.push('Xb','Xr');
  for(let i=cards.length-1;i>0;i--){const j=randomInt(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];}
  return cards;
}
export function createGame(name='You',count=6,rules={}) {
  if(!Number.isInteger(count)||count<5||count>8)throw new Error('Choose five to eight players.');
  name=String(name).trim();
  if(!name || name.length>24 || /[^\x20-\x7e]/.test(name))throw new Error('Use a name of 1 to 24 plain text characters.');
  const g={id:randomBytes(12).toString('hex'),rules:normalizeRules(rules),round:0,dealer:count-1,revision:0,phase:'complete',actor:-1,
    players:[{id:'you',name},...friends.slice(0,count-1)].map(p=>({...p,cards:[],score:0,wins:0,role:'Camper',memory:[]})),
    order:[],previous:[],history:[],talk:[],eventId:0};
  nextRound(g);return g;
}
function log(g,text,privateToHuman=false){g.history.push({id:++g.eventId,text,privateToHuman});g.history=g.history.slice(-100);}
function live(g,seat){return !!g.players[seat]?.cards.length&&!(g.forfeits||[]).includes(seat);}
function nextLive(g,seat){for(let n=1;n<=g.players.length;n++){const i=(seat+n)%g.players.length;if(live(g,i))return i;}return -1;}
export function nextRound(g,{deferExchange=false}={}) {
  if(g.phase!=='complete')throw new Error('Finish this round first.');
  g.previous=g.order.slice();g.order=[];g.forfeits=[];g.round++;g.revision++;g.dealer=(g.dealer+1)%g.players.length;
  g.played=[];g.pile=null;g.pileStart=null;g.passed=[];g.opening=g.round===1;g.last=-1;g.exchange=null;g.error='';
  g.roundEvents=[];g.trick=1;g.timelineComplete=true;
  g.lastTrick=null;g.revealUntil=0;
  const cards=deck(g.rules);g.players.forEach(p=>{p.cards=[];p.action='';p.exchangeKnowledge=[];});
  cards.forEach((c,i)=>g.players[(g.dealer+1+i)%g.players.length].cards.push(c));
  g.players.forEach(p=>sortCards(p.cards));
  log(g,'ROUND '+g.round+' - a fresh deal at the same picnic table.');
  if(g.previous.length) {
    const o=g.previous,n=o.length;
    g.exchange={pairs:[{high:o[0],low:o[n-1],count:2},{high:o[1],low:o[n-2],count:1}],returns:{}};
    // Gifts are chosen from the original deal, before anyone receives a card.
    for(const pair of g.exchange.pairs)if(pair.high!==0&&!deferExchange)g.exchange.returns[pair.high]=g.players[pair.high].cards.slice(0,pair.count);
    advanceExchange(g);
  }else {g.phase='playing';g.actor=g.players.findIndex(p=>p.cards.includes('3c'));log(g,g.players[g.actor].name+' opens with the three of clubs.');}
}
export function exchangeCards(g,cards) {
  returnExchange(g,0,cards);
}
export function returnExchange(g,seat,cards){
  if(g.phase!=='exchange'||g.actor!==seat)throw new Error('Wait for your card exchange choice.');
  const pair=g.exchange.pairs.find(p=>p.high===seat);
  if(!pair)throw new Error('This seat does not choose a return.');
  validateOwned(g.players[seat],cards,pair.count);
  g.exchange.returns[seat]=cards.slice();g.revision++;advanceExchange(g);
}
function advanceExchange(g){
  const pending=g.exchange.pairs.find(p=>!Object.hasOwn(g.exchange.returns,p.high));
  if(!pending){finishExchange(g);return;}
  g.phase='exchange';g.actor=pending.high;
  if(g.actor===0)log(g,'Choose any '+pending.count+' card'+(pending.count===1?'':'s')+' from your original deal to return. They do not have to be your lowest.');
  else log(g,g.players[g.actor].name+' is choosing cards to return.');
}
function finishExchange(g) {
  const transfers=[];
  g.players.forEach(p=>{p.exchangeKnowledge=p.exchangeKnowledge||[];});
  for(const pair of g.exchange.pairs){
    transfers.push({from:pair.low,to:pair.high,cards:g.players[pair.low].cards.slice(-pair.count)});
    transfers.push({from:pair.high,to:pair.low,cards:g.exchange.returns[pair.high]});
  }
  for(const t of transfers)g.players[t.from].cards=g.players[t.from].cards.filter(c=>!t.cards.includes(c));
  for(const t of transfers)g.players[t.to].cards.push(...t.cards);
  for(const t of transfers){
    g.players[t.from].exchangeKnowledge.push({direction:'gave',seat:t.to,cards:t.cards.slice()});
    g.players[t.to].exchangeKnowledge.push({direction:'received',seat:t.from,cards:t.cards.slice()});
  }
  g.players.forEach(p=>sortCards(p.cards));
  for(const t of transfers)if(t.from===0||t.to===0)log(g,(t.from===0?'You gave '+g.players[t.to].name:'You received from '+g.players[t.from].name)+': '+t.cards.join(', ')+'.',true);
  // Card identities in this exchange log are private to the human, never bot context.
  g.exchange=null;g.phase='playing';g.actor=g.previous[g.previous.length-1];
  log(g,'Rank exchange complete. '+g.players[g.actor].name+' (Asshole) leads.');
}
function validateOwned(p,cards,count) {
  if(!Array.isArray(cards)||cards.length!==count||new Set(cards).size!==cards.length||cards.some(c=>!p.cards.includes(c)))throw new Error('Choose the required cards from your own hand.');
}
// The same classification and comparison serve manual actions and bot suggestions.
export function combination(cards,input={}){
  const r=normalizeRules(input);
  if(!cards.length||cards.length>4)return null;
  if(cards.some(c=>c[0]==='X'))return r.jokers&&cards.length===1?{rank:13,clear:true}:null;
  if(cards.length===1&&cards[0][0]==='2'&&['clear','both'].includes(r.twos))return {rank:12,clear:true};
  const natural=['wild','both'].includes(r.twos)?cards.filter(c=>c[0]!=='2'):cards;
  if(natural.some(c=>c[0]!==natural[0][0]))return null;
  return {rank:natural.length?value(natural[0]):12,clear:false};
}
function canPlay(g,cards){
  const r=normalizeRules(g.rules),c=combination(cards,r);
  if(!c||g.opening&&!cards.includes('3c'))return false;
  if(c.rank===13&&g.players[g.actor].cards.length===1)return false;
  if(!g.pile||c.clear)return true;
  const previous=combination(g.pile.cards,r);
  return !previous.clear&&cards.length===g.pile.cards.length&&(c.rank>previous.rank||r.matching&&c.rank===previous.rank);
}
export function legalMoves(g,seat=g.actor) {
  if(g.phase!=='playing'||seat!==g.actor||!live(g,seat))return [];
  const p=g.players[seat],groups=[],r=normalizeRules(g.rules),wild=['wild','both'].includes(r.twos)?p.cards.filter(c=>c[0]==='2'):[];
  for(const rank of ranks){
    const cards=sortCards(p.cards.filter(c=>c[0]===rank));
    for(let n=1;n<=Math.min(4,cards.length);n++)for(let w=0;w<=(rank==='2'?0:Math.min(wild.length,4-n));w++){
      const choice=[...cards.slice(0,n),...wild.slice(0,w)];if(canPlay(g,choice))groups.push(choice);
    }
  }
  if(r.jokers)for(const c of p.cards.filter(c=>c[0]==='X'))if(canPlay(g,[c]))groups.push([c]);
  return groups;
}
export function act(g,seat,cards) {
  if(g.phase!=='playing'||g.actor!==seat||!live(g,seat))throw new Error('Wait for your turn.');
  const p=g.players[seat];
  if(!Array.isArray(cards))throw new Error('Choose cards or pass.');
  if(!cards.length){
    if(!g.pile)throw new Error('You must lead a card or a matching group.');
    g.passed.push(seat);p.action='Passed';log(g,p.name+' passes.');recordAction(g,{seat,name:p.name,action:'pass',cards:[]});
  }else{
    validateOwned(p,cards,cards.length);
    if(cards.length===p.cards.length&&cards.some(c=>c[0]==='X'))throw new Error('You cannot finish on a Joker.');
    if(g.opening&&!cards.includes('3c'))throw new Error('The opening play must include the three of clubs.');
    if(!canPlay(g,cards))throw new Error('That play does not fit this table\'s house rules. Check Rules for matching, wild twos and jokers.');
    const played=combination(cards,g.rules),special=played.clear;
    const tied=g.pile&&!special&&played.rank===combination(g.pile.cards,g.rules).rank;
    if(!g.pile)g.pileStart=seat;
    p.cards=p.cards.filter(c=>!cards.includes(c));g.played.push(...cards);g.pile={seat,cards:cards.slice()};
    // last identifies the winning high play, which stays with the first equal play.
    if(!tied)g.last=seat;g.opening=false;
    recordAction(g,{seat,name:p.name,action:'play',cards:cards.slice(),rank:played.rank,matched:!!tied,winningSeat:g.last});
    p.action='Played '+cards.join(' ');log(g,p.name+' plays '+cards.join(', ')+'.');
    if(!p.cards.length){g.order.push(seat);p.action='Finished #'+g.order.length;log(g,p.name+' finishes #'+g.order.length+'.');}
    if(settleJokerForfeits(g)){g.revision++;return;}
    if(special){clearPile(g);g.revision++;return;}
  }
  advanceTurn(g,seat);
  g.revision++;
}
function advanceTurn(g,seat){
  const boundary=normalizeRules(g.rules).pileMode==='single-lap'?g.pileStart:g.last;
  for(let step=1;step<=g.players.length;step++){
    const i=(seat+step)%g.players.length;
    // One lap stops at its original lead; continuous play stops at the high play.
    // A finished seat still marks the boundary of its circuit.
    if(i===boundary){clearPile(g);break;}
    if(live(g,i)&&!g.passed.includes(i)){g.actor=i;break;}
  }
}
function settleJokerForfeits(g){
  g.forfeits=g.forfeits||[];
  for(const [seat,p] of g.players.entries())if(p.cards.length&&p.cards.every(c=>c[0]==='X')&&!g.forfeits.includes(seat)){
    g.forfeits.push(seat);p.role=role(g.players.length-g.forfeits.length,g.players.length);p.action='Joker forfeit';
    log(g,p.name+' is left with only Jokers and forfeits: '+p.role+'.');
    recordAction(g,{action:'forfeit',seat,name:p.name,role:p.role,reason:'Only Jokers remain'});
  }
  const remaining=g.players.map((p,i)=>i).filter(i=>live(g,i));
  if(remaining.length>1)return false;
  g.order.push(...remaining,...g.forfeits.slice().reverse());g.phase='complete';g.actor=-1;
  if(g.pile)recordPileResult(g,-1);
  g.order.forEach((i,pos)=>{const q=g.players[i];q.role=role(pos,g.players.length);q.score+=g.players.length-pos-1;if(pos===0)q.wins++;});
  log(g,g.players[g.order[0]].name+' is President. '+g.players[g.order[g.order.length-1]].name+' is Asshole. Another round whenever you are ready.');
  return true;
}
function clearPile(g){
  const leader=live(g,g.last)?g.last:nextLive(g,g.last);
  recordPileResult(g,leader);
  recordAction(g,{action:'clear',winner:g.last,leader});g.trick++;
  log(g,'Pile cleared. '+g.players[leader].name+' leads.');
  g.pile=null;g.pileStart=null;g.passed=[];g.last=-1;g.actor=leader;
  g.players.forEach((q,i)=>{if(live(g,i))q.action='';});
}
function recordPileResult(g,leader){
  g.lastTrick=pileResult(g,g.last,leader,g.pile.cards,g.eventId,g.trick);
}
function pileResult(g,winner,leader,cards,id,trick){
  const play=combination(cards,g.rules);
  const rank=['three','four','five','six','seven','eight','nine','ten','jack','queen','king','ace','two','joker'][play.rank];
  const count=cards.length,label=count===1?rank:count+' '+rank+(rank==='six'?'es':'s');
  const lead=leader<0?'':g.players[leader].name+(leader===0&&g.players[leader].name==='You'?' lead':' leads');
  const next=leader<0?'The deal is finished.':leader===winner?lead+' again.':g.players[winner].name+' is out; '+lead+' next.';
  const win=g.players[winner].name+(winner===0&&g.players[winner].name==='You'?' win':' wins');
  return {id,round:g.round,trick,winner,leader,rank:play.rank,count,joker:play.rank===13,
    description:win+' the pile with '+(play.rank===13?'a joker':label)+'. '+next};
}
function restorePileResult(g){
  if(g.lastTrick||g.pile||g.phase!=='playing'||!g.played.length)return;
  const h=g.history;let clear=-1,start=0;
  for(let i=0;i<h.length;i++)if(h[i].text.startsWith('Pile cleared.')){start=clear+1;clear=i;}
  if(clear<0||h.slice(clear+1).some(e=>e.text.startsWith('ROUND ')))return;
  let roundStart=-1;for(let i=0;i<clear;i++)if(h[i].text.startsWith('ROUND '+g.round+' -'))roundStart=i;
  if(start===0&&roundStart<0)return; // A clipped log cannot establish the first tied play.
  start=Math.max(start,roundStart+1);
  let best=null;
  for(const e of h.slice(start,clear)){
    const seats=g.players.map((p,i)=>i).filter(i=>e.text.startsWith(g.players[i].name+' plays '));
    if(seats.length>1)return;
    if(!seats.length)continue;
    const seat=seats[0],cards=e.text.slice((g.players[seat].name+' plays ').length,-1).split(', ');
    if(cards.some(c=>!/^(?:[3456789TJQKA2][cdhs]|X[br])$/.test(c)))return;
    const play=combination(cards,g.rules);if(!play)return;
    if(!best||play.rank>best.rank)best={seat,cards,rank:play.rank};
  }
  if(best)g.lastTrick=pileResult(g,best.seat,g.actor,best.cards,h[clear].id,Math.max(1,g.trick-1));
}
export function publicView(g) {
  return {...g,players:g.players.map((p,i)=>({id:p.id,name:p.name,tag:p.tag||'One of the island crew',bio:p.bio||'Your seat at the picnic table.',style:p.style||'Make your own summer luck.',role:p.role,score:p.score,wins:p.wins,action:p.action,count:p.cards.length,cards:i===0?p.cards:[]})),
    exchange:g.phase==='exchange'?{count:g.exchange.pairs.find(p=>p.high===g.actor).count}:null,played:undefined,previous:undefined};
}
export function validateGame(g) {
  if(!g || !Array.isArray(g.players)||g.players.length<5||g.players.length>8||!['playing','exchange','complete'].includes(g.phase))throw new Error('Invalid saved game.');
  const rules=normalizeRules(g.rules),total=rules.jokers?54:52,cards=[...g.players.flatMap(p=>p.cards),...g.played];
  if(cards.length!==total||new Set(cards).size!==total||cards.some(c=>! /^[3456789TJQKA2][cdhs]$/.test(c)&&!(rules.jokers&&/^X[br]$/.test(c))))throw new Error('Invalid saved deck.');
  if(!Number.isSafeInteger(g.round)||g.round<1||!Number.isSafeInteger(g.revision)||g.revision<1||!Array.isArray(g.order)||!Array.isArray(g.history)||!Array.isArray(g.talk))throw new Error('Invalid saved state.');
  if(g.phase==='playing'&&(!g.players[g.actor]?.cards.length||g.passed.includes(g.actor)))throw new Error('Invalid saved turn.');
  if(g.forfeits!==undefined&&(!Array.isArray(g.forfeits)||new Set(g.forfeits).size!==g.forfeits.length||g.forfeits.some(i=>!Number.isInteger(i)||i<0||i>=g.players.length||!g.players[i].cards.length||g.players[i].cards.some(c=>c[0]!=='X'))))throw new Error('Invalid saved Joker forfeits.');
  if(rules.pileMode==='single-lap'&&g.pile&&(!Number.isInteger(g.pileStart)||g.pileStart<0||g.pileStart>=g.players.length))throw new Error('Invalid saved pile lead.');
  g.rules=rules; // Saves from before selectable rules retain the original rules.
  initializeLedger(g);
  restorePileResult(g);
  if(g.phase==='playing'){
    const before=(g.forfeits||[]).length,seat=g.actor;
    const complete=settleJokerForfeits(g);
    if(!complete&&!live(g,seat)){if(g.pile)advanceTurn(g,seat);else g.actor=nextLive(g,seat);}
    if(complete||g.forfeits.length!==before)g.revision++;
  }
  return g;
}
