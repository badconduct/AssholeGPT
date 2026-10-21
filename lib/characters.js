export const friends = [
  {id:'maya',name:'Maya',tag:'Keeper of the mixtapes',style:'Patient; saves her high cards.',tone:'amber',
    bio:'24. Packed a CD wallet bigger than her tent. Knows every lyric, and exactly when to take the lead.',
    lines:['That one goes on the summer mix.','Someone flip the CD when this round ends.','I can wait. The lake is not going anywhere.'],pass:['Saving my energy for the swim back.','Go on. I am listening to the good bit.']},
  {id:'owen',name:'Owen',tag:'The overprepared camper',style:'Tries to shed awkward groups first.',tone:'green',
    bio:'26. Brought a tarp, three torches and a laminated ferry timetable. Still forgot a pillow.',
    lines:['All part of a very loose plan.','The tarp committee approves this move.','I packed a spare deck. Obviously.'],pass:['I will supervise this one.','Making a tactical tea stop.']},
  {id:'jules',name:'Jules',tag:'Disposable-camera documentarian',style:'Pushes the pace with big groups.',tone:'rose',
    bio:'23. Determined to use all 27 exposures before the ferry home. Every terrible haircut deserves a record.',
    lines:['Hold that face. That is the photo.','This is absolutely going in the album.','Summer of bad decisions, excellent company.'],pass:['Out of film. Out of ideas.','Pretend I am taking a scenic shot.']},
  {id:'dev',name:'Dev',tag:'Portable-speaker engineer',style:'Likes control; competes for the lead.',tone:'blue',
    bio:'25. Has wired a portable CD player to speakers held together with tape. Calls the hiss atmosphere.',
    lines:['That deserves a bass drop.','The batteries have another hour. Probably.','Good reception at this end of the table.'],pass:['Little interference over here.','You have the aux cable for now.']},
  {id:'beck',name:'Beck',tag:'Self-appointed fire marshal',style:'Unpredictable; changes tempo.',tone:'orange',
    bio:'27. Makes spectacular toast and dubious ghost stories. Has appointed the cooler an official throne.',
    lines:['The cooler throne is calling my name.','Put that in the camp minutes.','Winner gets the unburnt marshmallow.'],pass:['I am checking on the fire. Mentally.','Even legends need a breather.']},
  {id:'nina',name:'Nina',tag:'First one into the water',style:'Plays low and keeps useful pairs.',tone:'teal',
    bio:'24. Came for the swimming, stayed for the arguments about card rules. Keeps all the shoes above the tide.',
    lines:['Still easier than getting you lot in the water.','The tide is turning. Very poetic.','One more round, then a swim.'],pass:['Just floating through this one.','I will watch from the shore.']},
  {id:'eli',name:'Eli',tag:'Instant-noodle philosopher',style:'Conserves control cards for the end.',tone:'purple',
    bio:'26. Brought a notebook and six packets of noodles. Has strong opinions about the perfect two-minute meal.',
    lines:['There is a metaphor here somewhere.','Another entry for the island notebook.','We should have brought more noodles.'],pass:['I need to think about this over noodles.','A moment of quiet contemplation.']}
];
const finishRemarks = {
  maya:'Put that on the summer mix.',
  owen:'Exactly as the laminated plan predicted.',
  jules:'Get a photo. This is going in the album.',
  dev:'Cue the victory music.',
  beck:'The cooler throne committee has spoken.',
  nina:'Right, who is coming for a swim?',
  eli:'An entire notebook entry in one moment.'
};
export function finishLine(id,position,count){
  return "I'm "+role(position,count)+'! '+finishRemarks[id];
}
export function role(position,count) {
  if(position===0)return 'President';
  if(position===1)return 'Vice President';
  if(position===count-1)return 'Asshole';
  if(position===count-2)return 'Vice Asshole';
  return 'Citizen';
}
