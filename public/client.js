/* HTML4 / ECMAScript 3 client. Rules, secrets and bot decisions live on the server. */
var Island=(function(){
  var state=null,csrf='',revision=0,selected=[],moves=[],pending=false,timer=null,signature='',renderKey='',suggestion=0,classic=false,menuOpen=true;
  function el(id){return document.getElementById(id);}
  function text(n){return n?(typeof n.textContent==='string'?n.textContent:n.text||''):'';}
  function esc(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  function attr(n,k){return n?n.getAttribute(k)||'':'';}
  function list(n,k){return n?n.getElementsByTagName(k):[];}
  function has(a,x){for(var i=0;i<a.length;i++)if(a[i]===x)return true;return false;}
  function show(id,on){var n=el(id);n.style.display=on?(n.tagName==='BUTTON'||n.tagName==='INPUT'?'inline':'block'):'none';}
  function message(s,error){el('message').className='message'+(error?' error':'');el('message').innerHTML=esc(s);}
  function encode(o){var a=[],k;for(k in o)if(o.hasOwnProperty(k))a.push(encodeURIComponent(k)+'='+encodeURIComponent(o[k]));return a.join('&');}
  function request(path,data){
    if(pending)return;pending=true;controls();if(timer){window.clearTimeout(timer);timer=null;}
    var x;
    try{x=window.XMLHttpRequest?new XMLHttpRequest():new ActiveXObject('Microsoft.XMLHTTP');}
    catch(e){pending=false;message('This browser needs XMLHTTP / ActiveX enabled to reach the island dealer.',true);return;}
    x.onreadystatechange=function(){
      if(x.readyState!==4)return;
      pending=false;
      if(x.responseXML&&x.responseXML.documentElement&&x.responseXML.documentElement.nodeName==='game'){
        render(x.responseXML.documentElement);
      }else{message('The dealer could not be reached. Reconnecting...',true);timer=window.setTimeout(poll,2500);}
    };
    try{x.open(data?'POST':'GET',path,true);if(data){x.setRequestHeader('Content-Type','application/x-www-form-urlencoded');x.setRequestHeader('X-CSRF',csrf);}x.send(data?encode(data):null);}
    catch(e){pending=false;message('Connection interrupted. Reconnecting...',true);timer=window.setTimeout(poll,2500);}
  }
  function poll(){request('/api/state');}
  function send(action,data){data=data||{};data.revision=revision;request('/api/'+action,data);}
  function suit(c){return {c:'&clubs;',d:'&diams;',h:'&hearts;',s:'&spades;'}[c.charAt(1)]||'';}
  function jokerImage(c,disabled,chosen){return '/images/joker-'+(c==='Xr'?'red':'black')+'-icon'+(disabled?'-inactive':chosen?'-selected':'')+'.jpg';}
  function capScore(raw,exact){
    var n=Number(raw),v,unit=0,units=['','k','m','b','t'],label,full,h,i,count;
    if(!isFinite(n))n=0;v=Math.abs(n);full=(n>0?'+':'')+n.toFixed(0);
    while(v>=1000&&unit<4){v/=1000;unit++;}
    label=exact||unit===0?full:(n<0?'-':'+')+v.toFixed(1).replace(/\.0$/,'')+units[unit];
    count=Math.min(3,Math.abs(n));
    h='<span class="cap-score'+(n<0?' debt':'')+'" title="'+full+' bottle caps. '+(n<0?'Upside down':n>0?'Right side up':'No caps yet')+'. Stack is symbolic; the number is the total."><span class="cap-stack">';
    for(i=0;i<count;i++)h+='<img src="/images/bottle-cap-'+(n<0?'down':'up')+'.gif" width="20" height="14" alt="" style="left:'+(i*3)+'px;top:'+(4-i*2)+'px">';
    return h+'</span><span class="cap-total">'+esc(label)+'</span></span>';
  }
  function canChoose(){
    return !!state&&!pending&&attr(state,'actor')==='0'&&(attr(state,'phase')==='playing'||attr(state,'phase')==='exchange')&&attr(state,'busy')!=='1'&&attr(state,'paused')!=='1'&&Number(attr(state,'revealMs'))<=0;
  }
  function card(c,click,chosen,disabled){
    var joker=c.charAt(0)==='X',red=c.charAt(1)==='d'||c.charAt(1)==='h'||c==='Xr',rank=joker?'JOKER':c.charAt(0)==='T'?'10':c.charAt(0),label=joker?(red?'Red joker':'Black joker'):rank+' of '+{c:'clubs',d:'diamonds',h:'hearts',s:'spades'}[c.charAt(1)];
    var face=joker?'<img class="joker-face" src="'+jokerImage(c,disabled,chosen)+'" width="33" height="44" alt="'+label+'">':rank+'<span class="suit">'+suit(c)+'</span>';
    return '<'+(click?'button type="button"':'span')+' class="card'+(joker?' joker':'')+(red?' red':'')+(chosen?' selected':'')+(disabled?' inactive':'')+'" title="'+label+'"'+(click?' onclick="Island.select(\''+c+'\')"'+(disabled?' disabled="disabled"':'')+' aria-pressed="'+(chosen?'true':'false')+'"':'')+'>'+face+'</'+(click?'button':'span')+'>';
  }
  function drawHand(){
    if(!state)return;var players=list(state,'player'),cards=players.length?list(players[0],'card'):[],h='',i,c,phase=attr(state,'phase');
    for(i=0;i<cards.length;i++){c=text(cards[i]);h+=card(c,true,has(selected,c),!canChoose());}el('hand').innerHTML=h;
    el('selection').innerHTML=selected.length?selected.length+' selected':'Click cards to choose your play';
    controls();
  }
  function controls(){
    if(!state)return;var phase=attr(state,'phase'),busy=attr(state,'busy')==='1'||Number(attr(state,'revealMs'))>0,human=attr(state,'actor')==='0',error=attr(state,'paused')==='1';
    var choose=canChoose(),handButtons=el('hand').getElementsByTagName('button'),i;
    for(i=0;i<handButtons.length;i++){
      handButtons[i].disabled=!choose;handButtons[i].className=handButtons[i].className.replace(/ inactive/g,'')+(choose?'':' inactive');
      var face=handButtons[i].getElementsByTagName('img')[0];
      if(face){var src=jokerImage(handButtons[i].title==='Red joker'?'Xr':'Xb',!choose,handButtons[i].className.indexOf(' selected')!==-1);if(face.getAttribute('src')!==src)face.src=src;}
    }
    el('clear').disabled=!choose||!selected.length;
    el('play').disabled=!choose||!selected.length;
    el('play').className='primary'+(el('play').disabled?' inactive':'');
    el('play').innerHTML=phase==='exchange'?'Return '+attr(state,'exchange')+' card(s)':'Play selected';
    el('pass').disabled=pending||busy||!human||phase!=='playing'||!list(list(state,'pile')[0],'card').length||!!error;
    el('suggest').disabled=!choose||phase!=='playing'||!moves.length;
    show('play',phase!=='complete');show('pass',phase==='playing');show('next',phase==='complete');el('next').disabled=busy||pending;
    show('retry',!!error);el('retry').disabled=busy||pending;el('saveButton').disabled=!list(state,'player').length||busy||pending;
  }
  function render(g){
    csrf=attr(g,'csrf');revision=Number(attr(g,'revision'));state=g;
    var phase=attr(g,'phase'),busy=attr(g,'busy')==='1',actor=Number(attr(g,'actor')),players=list(g,'player'),pile=list(g,'pile')[0],pc=list(pile,'card'),err=text(list(g,'error')[0]),i,j,h='',p,seat,role,finish,lines=list(g,'line'),events=list(g,'event'),order=list(g,'seat'),round=attr(g,'round'),rules=list(g,'rules')[0];
    var sig=attr(g,'recovery')+':'+round+':'+revision+':'+phase;
    var revealing=Number(attr(g,'revealMs'))>0,result=list(g,'trickResult')[0];
    var key=sig+':'+busy+':'+revealing+':'+err+':'+attr(g,'save')+':'+csrf;
    if(key===renderKey){controls();if(revealing||busy||(phase==='playing'&&actor>0&&!err))timer=window.setTimeout(poll,700);return;}
    renderKey=key;
    if(sig!==signature){selected=[];suggestion=0;signature=sig;}
    moves=[];var ms=list(g,'move');for(i=0;i<ms.length;i++)moves.push(text(ms[i]).split(','));
    el('recovery').value=attr(g,'recovery')||'Start a game first';
    if(attr(g,'save')){el('snapshot').value=attr(g,'save');show('saves',true);}
    el('continue').style.display=players.length?'inline':'none';
    if(players.length){var descriptions=list(rules,'rule');h='<p><strong>THIS TABLE: '+esc(attr(rules,'summary'))+'</strong></p>';for(i=0;i<descriptions.length;i++)h+='<p>'+esc(text(descriptions[i]))+'</p>';el('activeRules').innerHTML=h;}
    if(!players.length){menuOpen=true;show('lobby',true);show('game',false);message(err||'Pull up a camping chair.',!!err);return;}
    show('lobby',menuOpen);show('game',!menuOpen);
    el('trip').innerHTML='Pinecone Island &nbsp;/&nbsp; Round '+round+' &nbsp;/&nbsp; '+players.length+' friends';
    h='<table class="seats" width="724" cellspacing="3" cellpadding="0"><tr>';
    for(i=0;i<players.length;i++){
      p=players[i];finish=attr(p,'finish');role=attr(p,'role');
      h+='<td class="seat'+(i===actor&&phase==='playing'?' active':'')+(finish!=='0'?' finished':'')+'" title="'+esc(attr(p,'tag')+' - '+attr(p,'style'))+'"><img class="portrait" src="/portraits/'+attr(p,'id')+'.jpg" alt="'+esc(attr(p,'name'))+'"><div class="seatname">'+esc(attr(p,'name'))+'</div><div class="seatcount">'+attr(p,'count')+' <span>left</span></div><div class="seatrole">'+esc(role)+'</div><div class="seataction">'+(attr(p,'forfeit')==='1'?'Joker forfeit':finish!=='0'?'Finished #'+finish:attr(p,'passed')==='1'?'Passed':i===actor?'At the table':'In the round')+'</div><div class="seatcaps">'+capScore(attr(p,'score'),false)+'</div></td>';
    }
    el('seats').innerHTML=h+'</tr></table>';
    h='';for(i=0;i<pc.length;i++)h+=card(text(pc[i]),false,false,false);
    el('pile').innerHTML=h||'<span class="empty">'+(phase==='complete'?'Round in the books.':phase==='exchange'?'The changing of the guard.':result?esc(attr(players[actor],'name'))+' leads.':'A fresh patch of table.')+'</span>';
    seat=Number(attr(pile,'seat'));var winner=attr(pile,'winner')===''?seat:Number(attr(pile,'winner'));el('pileCaption').innerHTML=pc.length?esc(attr(players[seat],'name'))+' PLAYED '+pc.length+' CARD'+(pc.length===1?'':'S')+(winner!==seat?' / '+esc(attr(players[winner],'name'))+' HOLDS THE LEAD':''):'THE PICNIC TABLE';
    var status=phase==='exchange'?(actor===0?'Choose any '+attr(g,'exchange')+' card(s) to return.':esc(attr(players[actor],'name'))+' is choosing return cards...'):phase==='complete'?esc(attr(players[Number(text(order[0]))],'name'))+' is President. Ready for another?':actor===0?'Your turn. '+(pc.length?(attr(rules,'matching')==='true'?'Match, beat or pass.':'Beat the pile or pass.'):'Lead a card or a group.'):(esc(attr(players[actor],'name'))+' is choosing a play...');
    el('turn').innerHTML=status;el('sceneNote').innerHTML=phase==='complete'?'Same friends. New ranks. The weekend keeps going.':phase==='exchange'?'Choose from your original deal before receiving the high cards.':!pc.length&&result?esc(text(result)):esc(attr(rules,'summary'));
    show('jokerFlash',revealing&&attr(result,'joker')==='1');
    if(revealing&&result){var jokerSeat=Number(attr(result,'winner')),jokerName=attr(players[jokerSeat],'name'),jokerCode='Xb',jokerMatch;for(i=events.length-1;i>=0;i--){jokerMatch=/ plays (X[br])\.$/.exec(text(events[i]));if(jokerMatch){jokerCode=jokerMatch[1];break;}}el('jokerArt').src=jokerImage(jokerCode);el('jokerWinner').innerHTML=esc(jokerName)+(jokerSeat===0&&jokerName==='You'?' win':' wins')+' the pile!';el('turn').innerHTML='Joker! The next lead follows the announcement.';}
    el('handTitle').innerHTML=phase==='exchange'&&actor===0?'CHOOSE YOUR RETURN':'YOUR HAND';
    if(lines.length){var q=lines[lines.length-1],speaker=players[Number(attr(q,'seat'))];el('quote').innerHTML='<strong>'+esc(attr(q,'name'))+':</strong> '+esc(text(q));el('speaker').src='/portraits/'+attr(speaker,'id')+'.jpg';}
    h='<p class="fine">President +2 / Vice President +1 / Citizens 0 / Vice Asshole -1 / Asshole -2.<br>Right side up: positive. Upside down: negative. Caps cancel out; the number is your total. Scores stay with this table and its saves.</p><table class="scoreboard"><tr><th>Friend</th><th>Current rank</th><th>Bottle caps</th><th>Presidencies</th></tr>';
    for(i=0;i<players.length;i++){p=players[i];h+='<tr><td>'+esc(attr(p,'name'))+'</td><td>'+esc(attr(p,'role'))+'</td><td>'+capScore(attr(p,'score'),true)+'</td><td>'+attr(p,'wins')+'</td></tr>';}el('scoreTable').innerHTML=h+'</table>';
    h='';for(i=1;i<players.length;i++){p=players[i];h+='<div class="bio"><strong>'+esc(attr(p,'name')+' - '+attr(p,'tag'))+'</strong><br>'+esc(attr(p,'bio'))+'</div>';}el('bios').innerHTML=h;
    var history=el('history'),atBottom=history.scrollHeight-history.scrollTop-history.clientHeight<24;
    h='';for(i=0;i<events.length;i++){h+='<div>'+esc(text(events[i]).replace(/\bXr\b/g,'JOKER (red)').replace(/\bXb\b/g,'JOKER (black)'))+'</div>';for(j=0;j<lines.length;j++)if(attr(lines[j],'id')===attr(events[i],'id'))h+='<div><em>'+esc(attr(lines[j],'name')+': '+text(lines[j]))+'</em></div>';}
    history.innerHTML=h;if(atBottom)history.scrollTop=history.scrollHeight;
    el('roundLabel').innerHTML='ROUND '+round+' &nbsp;/&nbsp; '+esc(attr(g,'mode')==='codex'?'CHATGPT':attr(g,'mode').toUpperCase())+' FRIENDS';
    message(err||(revealing?'Joker! '+text(result):busy?'The cards are going around the table.':phase==='exchange'?'A little island politics before the next round.':phase==='complete'?'Ranks settled. There is always another round.':'The ferry can wait.'),!!err);
    drawHand();if(revealing||busy||(phase==='playing'&&actor>0&&!err))timer=window.setTimeout(poll,700);
  }
  return {
    start:function(){menuOpen=false;send('new',{name:el('name').value,count:el('count').value,matching:el('matching').value,twos:el('twos').value,jokers:el('jokers').value,pileMode:el('pileMode').value});},
    menu:function(){menuOpen=true;show('lobby',true);show('game',false);},
    resume:function(){menuOpen=false;show('lobby',false);show('game',true);poll();},
    select:function(c){if(!canChoose())return;var a=[],i,owned=false,cards=list(list(state,'player')[0],'card');for(i=0;i<cards.length;i++)if(text(cards[i])===c)owned=true;if(!owned)return;for(i=0;i<selected.length;i++)if(selected[i]!==c)a.push(selected[i]);if(!has(selected,c))a.push(c);selected=a;drawHand();},
    clear:function(){if(!canChoose())return;selected=[];drawHand();},
    suggest:function(){if(canChoose()&&attr(state,'phase')==='playing'&&moves.length){selected=moves[suggestion%moves.length].slice(0);suggestion++;drawHand();}},
    play:function(){if(!canChoose()||!selected.length)return;send(attr(state,'phase')==='exchange'?'exchange':'action',{cards:selected.join(',')});},
    pass:function(){if(!canChoose()||attr(state,'phase')!=='playing'||!list(list(state,'pile')[0],'card').length)return;send('action',{cards:''});},next:function(){send('next');},retry:function(){send('retry');},
    save:function(){send('save');},load:function(){menuOpen=false;send('load',{code:el('loadCode').value.replace(/^\s+|\s+$/g,'')});},
    panel:function(id){show(id,el(id).style.display==='none');if(id==='journal')el('history').scrollTop=el('history').scrollHeight;},
    classic:function(){classic=!classic;el('scene').className='scene'+(classic?' classic':'');el('view').innerHTML=classic?'View: Scenic':'View: Classic';document.cookie='islandview='+(classic?'classic':'scenic')+'; path=/; expires=Thu, 31 Dec 2037 23:59:59 GMT';},
    init:function(){if(document.cookie.indexOf('islandview=classic')!==-1)this.classic();poll();}
  };
}());
Island.init();
