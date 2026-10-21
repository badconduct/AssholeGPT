export const defaultRules=Object.freeze({matching:false,twos:'high',jokers:false,pileMode:'continuous'});
export function normalizeRules(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(defaultRules,k)))throw new Error('Invalid house rules.');
  const r={...defaultRules,...input};
  if(typeof r.matching!=='boolean'||typeof r.jokers!=='boolean'||!['high','wild','clear','both'].includes(r.twos)||!['single-lap','continuous'].includes(r.pileMode))throw new Error('Invalid house rules.');
  return r;
}
export function ruleDescriptions(input){
  const r=normalizeRules(input);
  return [
    r.matching?'Matching allowed: same number of cards, equal or higher rank. The first play at the highest rank wins ties; matching does not take the lead or skip anyone.':'Higher only: same number of cards, strictly higher rank.',
    r.pileMode==='single-lap'?'One lap per pile: the lead and every other unfinished player each get at most one turn. Stop when the turn would return to the original lead seat, even if that player finished. The highest play wins, first wins ties, and the winner leads the next pile. A later higher play does not extend this lap.':'Continuous laps: players can respond again on later laps. A higher play takes the lead and starts a new circuit; stop when the turn would return to the first player at the highest rank. That winner leads the next pile.',
    ({high:'Twos are ordinary highest cards; match the pile size.',wild:'Twos fill groups: mix twos with one natural rank, up to four cards. The group takes the natural rank. All-twos groups rank above aces and must match pile size.',clear:'A single two beats any pile and clears it immediately. Groups of twos are ordinary highest groups.',both:'Twos fill groups, and a single two beats any pile and clears it immediately.'})[r.twos],
    r.jokers?'Two jokers added (54 cards). Play one joker alone to beat any pile and clear it immediately. Jokers cannot fill groups or be combined. You cannot finish on a Joker. Being left with only Jokers forfeits the deal: the first such player takes Asshole, later forfeits take the next lowest unclaimed rank. Everyone else continues playing for the remaining ranks. Use Jokers before shedding your last ordinary card.':'No jokers (52 cards).',
    'After a special clear, its player leads again; if finished, the next unfinished player clockwise leads. Opening play must still include 3c.',
    'President chooses any two cards to return; Vice President chooses any one. They do not have to choose their lowest cards. Choices come from the original deal, before receiving gifts. Asshole must give their two highest cards, and Vice Asshole their highest.',
    'Passing locks you out until the pile clears. Rank exchange and scoring stay the same. These choices stay with this table and its saves.'
  ];
}
export const ruleSummary=input=>{const r=normalizeRules(input);return (r.pileMode==='single-lap'?'One lap':'Continuous laps')+' / '+(r.matching?'Match or beat':'Beat only')+' / Twos: '+({high:'high',wild:'fill groups',clear:'clear',both:'fill + clear'})[r.twos]+' / '+(r.jokers?'2 unbeatable jokers':'No jokers');};
