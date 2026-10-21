import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createGame, legalMoves, act } from '../lib/game.js';
import { configuration, checkConnection, decision, quote } from '../lib/ai.js';
import { friends, role } from '../lib/characters.js';

test('compatible API chooses indexed legal moves and rejects illegal decisions without fallback',async()=>{
  let reply={move:0,say:'The cooler throne awaits.',memory:'Test observation.'},seen=[];
  const api=http.createServer(async(req,res)=>{
    let body='';for await(const c of req)body+=c;seen.push({headers:req.headers,body:JSON.parse(body)});
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(reply)}}]}));
  });api.listen(0,'127.0.0.1');await once(api,'listening');
  try{
    const c=configuration({AI_MODE:'api',AI_URL:'http://127.0.0.1:'+api.address().port+'/v1/chat/completions',AI_MODEL:'fixture',AI_TOKEN:'server-only-fixture'});await checkConnection(c);
    let g;do{g=createGame();}while(g.actor===0);
    const seat=g.actor,before=JSON.stringify(g),d=await decision(g,seat,c);assert.deepEqual(d.cards,legalMoves(g,seat)[0]);assert.equal(JSON.stringify(g),before);
    assert.equal(seen[0].headers.authorization,'Bearer server-only-fixture');assert.equal(seen[0].body.model,'fixture');
    const context=JSON.parse(seen[0].body.messages[1].content);assert.deepEqual(context.ownCards,g.players[seat].cards);assert.ok(context.players.every(p=>!p.cards));
    reply={move:9999,say:'I win.',memory:'Bad move.'};await assert.rejects(decision(g,seat,c),/illegal move/);assert.equal(JSON.stringify(g),before);
    reply={move:-1,say:'I pass.',memory:'Bad lead.'};await assert.rejects(decision(g,seat,c),/illegal move/);
  }finally{api.closeAllConnections();await new Promise(r=>api.close(r));}
});
test('provider configuration rejects missing settings and unsafe endpoints',()=>{
  assert.equal(configuration({AI_MODE:'chatgpt'}).mode,'codex');
  for(const env of [{AI_MODE:'unknown'},{AI_MODE:'api'},{AI_MODE:'api',AI_MODEL:'x',AI_URL:'file:///tmp/x'},{AI_MODE:'api',AI_MODEL:'x',AI_URL:'http://user:password@example.com/'},{AI_TIMEOUT_MS:'0'}])assert.throws(()=>configuration(env));
});

test('forced passes bypass providers but playable replies and voluntary passes still use the model',async()=>{
  let calls=0,move=0;
  const api=http.createServer((req,res)=>{
    calls++;req.resume();res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({move,say:'I will wait.',memory:'Considered the table.'})}}]}));
  });api.listen(0,'127.0.0.1');await once(api,'listening');
  try{
    const c=configuration({AI_MODE:'api',AI_URL:'http://127.0.0.1:'+api.address().port,AI_MODEL:'fixture'});
    const g=createGame('You',5,{matching:true,twos:'wild',jokers:true});
    g.opening=false;g.actor=1;g.pile={seat:0,cards:['Ac','Ad']};g.last=0;g.players[1].cards=['3c','4c'];
    const before=JSON.stringify(g);
    for(const config of [c,{mode:'codex',codexCommand:'must-not-run'}, {mode:'local'}]){
      assert.deepEqual((await decision(g,1,config)).cards,[]);
    }
    assert.equal(calls,0);assert.equal(JSON.stringify(g),before);
    // A Joker or wild-filled matching pair is a real option, even against aces.
    for(const cards of [['3c','Xr'],['Ah','2c','3c']]){
      g.players[1].cards=cards;
      assert.deepEqual((await decision(g,1,c)).cards,legalMoves(g,1)[0]);
    }
    assert.equal(calls,2);
    move=-1;assert.deepEqual((await decision(g,1,c)).cards,[]);assert.equal(calls,3);
  }finally{api.closeAllConnections();await new Promise(r=>api.close(r));}
});

test('legal hand-emptying plays bypass every provider and announce the newly earned role in character',async()=>{
  for(const config of [{mode:'api',url:'must-not-call'},{mode:'codex',codexCommand:'must-not-run'},{mode:'local'}]){
    for(const cards of [['Ac'],['8c','8d'],['8c','2d']]){
      for(let position=0;position<4;position++){
        const g=createGame('You',5,{matching:true,twos:'wild',jokers:true});g.opening=false;g.actor=1;
        g.order=[0,2,3].slice(0,position);g.order.forEach(i=>g.players[i].cards=[]);
        g.players[1].cards=cards.slice();g.players[1].role='Asshole';
        g.pile={seat:4,cards:cards.length===2?['7c','7d']:['7c']};g.last=4;g.pileStart=4;
        const before=JSON.stringify(g),d=await decision(g,1,config);assert.equal(JSON.stringify(g),before);assert.deepEqual(d.cards,cards);
        assert.match(d.say,new RegExp("^I'm "+role(position,5)+'!'));
        act(g,1,d.cards);quote(g,1,false,d.say);
        assert.equal(g.players[1].cards.length,0);assert.equal(g.order.indexOf(1),position);assert.equal(g.talk.at(-1).text,d.say);
      }
    }
  }
  const lines=new Set();
  for(const f of friends){
    const g=createGame('You',8);g.opening=false;g.actor=g.players.findIndex(p=>p.id===f.id);g.players[g.actor].cards=['3c'];g.pile=null;
    const seat=g.actor,d=await decision(g,seat,{mode:'api',url:'must-not-call'});act(g,seat,d.cards);quote(g,seat,false,d.say);assert.equal(g.talk.at(-1).text,d.say);lines.add(d.say);
  }
  assert.equal(lines.size,friends.length);
});
