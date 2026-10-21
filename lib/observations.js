import { normalizeRules } from './rules.js';

// Only verified public actions enter this ledger. Never inspect opponents' hands.
export function legacyLedger(g){
  const marker='ROUND '+g.round+' -',history=g.history||[];
  let start=-1;
  for(let i=0;i<history.length;i++)if(history[i].text.startsWith(marker))start=i;
  const complete=start>=0;
  if(!complete)for(let i=0;i<history.length;i++)if(history[i].text.startsWith('Pile cleared.'))start=i;
  const events=[];let trick=1;
  if(start>=0)for(const e of history.slice(start+1)){
    const matches=g.players.map((p,seat)=>({p,seat})).filter(({p})=>e.text.startsWith(p.name+' plays ')||e.text===p.name+' passes.');
    if(matches.length===1){
      const {p,seat}=matches[0],pass=e.text===p.name+' passes.';
      const cards=pass?[]:e.text.slice((p.name+' plays ').length,-1).split(', ');
      if(cards.every(c=>/^(?:[3456789TJQKA2][cdhs]|X[br])$/.test(c)))events.push({sequence:events.length+1,round:g.round,trick,seat,name:p.name,action:pass?'pass':'play',cards});
    }else if(e.text.startsWith('Pile cleared.')){events.push({sequence:events.length+1,round:g.round,trick,action:'clear'});trick++;}
  }
  return {events,trick,complete};
}
export function initializeLedger(g){
  if(Array.isArray(g.roundEvents))return;
  const legacy=legacyLedger(g);g.roundEvents=legacy.events;g.trick=legacy.trick;g.timelineComplete=legacy.complete;
}
export function recordAction(g,event){
  initializeLedger(g);
  g.roundEvents.push({sequence:g.roundEvents.length+1,round:g.round,trick:g.trick,...event});
}
export function publicKnowledge(g,seat){
  const legacy=Array.isArray(g.roundEvents)?null:legacyLedger(g);
  const events=g.roundEvents||legacy.events,trick=g.trick||legacy?.trick||1,rules=normalizeRules(g.rules);
  const own=g.players[seat].cards,played=g.played||[],byRank={};
  for(const rank of '3456789TJQKA2'){
    const used=played.filter(c=>c[0]===rank).length,inHand=own.filter(c=>c[0]===rank).length;
    byRank[rank]={played:used,inOwnHand:inHand,unseen:4-used-inHand};
  }
  const used=played.filter(c=>c[0]==='X').length,inHand=own.filter(c=>c[0]==='X').length;
  byRank.jokers={played:used,inOwnHand:inHand,unseen:(rules.jokers?2:0)-used-inHand};
  const current=events.filter(e=>e.trick===trick),complete=legacy?legacy.complete:g.timelineComplete!==false;
  return {roundTimeline:events,roundTimelineComplete:complete,lastPileResult:g.lastTrick||null,
    firstPlayOfRound:complete?(events.find(e=>e.action==='play')||null):null,
    currentTrick:{number:trick,startingSeat:g.pile?(g.pileStart??current.find(e=>e.action==='play')?.seat??null):null,firstPlay:current.find(e=>e.action==='play')||null,orderedActions:current,winningSeat:g.pile?g.last:null},
    cardTracking:{playedCards:played.slice(),byRank,meaning:'Unseen means not played and not in your own hand. Locations of unseen cards are unknown.'}};
}
