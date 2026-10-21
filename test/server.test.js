import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import http from 'node:http';
import { createApp } from '../server.js';

function field(xml,key){return new RegExp(' '+key+'="([^"]*)"').exec(xml)?.[1];}
test('HTTP setup, CSRF, stale actions, autonomous bots and durable save restore',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'island-test-')),server=createApp({mode:'local'},{saveDir:dir,turnDelay:0,jokerDelay:0});server.listen(0,'127.0.0.1');await once(server,'listening');
  const url='http://127.0.0.1:'+server.address().port;let cookie='',csrf='',state='';
  async function req(path,data,headers={}){
    const r=await fetch(url+path,{method:data?'POST':'GET',headers:{Cookie:cookie,...(data?{'X-CSRF':csrf,'Content-Type':'application/x-www-form-urlencoded'}:{}),...headers},...(data?{body:new URLSearchParams(data)}:{})});
    if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];state=await r.text();csrf=field(state,'csrf')||csrf;return r;
  }
  async function idle(){for(let i=0;i<500;i++){await req('/api/state');if(field(state,'busy')==='0')return;await new Promise(r=>setTimeout(r,5));}throw new Error('Bots stalled');}
  try{
    assert.equal((await req('/healthz')).status,200);assert.equal((await req('/api/state')).status,200);
    assert.equal((await req('/api/new',{name:'Camper',count:6},{'X-CSRF':'bad'})).status,400);
    assert.equal((await req('/api/new',{name:'Camper',count:8},{Origin:'http://wrong.example'})).status,400);
    assert.equal((await req('/api/new',{name:'Camper',count:8,twos:'bogus'})).status,400);
    assert.equal((await req('/api/new',{name:'Camper',count:8,pileMode:'bogus'})).status,400);
    assert.equal((await req('/api/new',{name:'Camper',count:8,matching:'true',twos:'wild',jokers:'true',pileMode:'single-lap'})).status,200);await idle();
    assert.match(state,/<rules matching="true" twos="wild" jokers="true" pileMode="single-lap"/);
    assert.equal((state.match(/<player /g)||[]).length,8);assert.equal(field(state,'actor'),'0');
    const revision=field(state,'revision');assert.equal((await req('/api/action',{revision:-1,cards:''})).status,400);
    const move=/<move>([^<]+)<\/move>/.exec(state)?.[1]||'';if(!move)assert.match(state,/<pile[^>]*><card>/);
    assert.equal((await req('/api/action',{revision,cards:move})).status,200);await idle();
    assert.equal((await req('/api/save',{})).status,200);const snapshot=field(state,'save'),recovery=field(state,'recovery');assert.match(snapshot,/^[a-f0-9]{36}$/);const savedRevision=field(state,'revision');
    cookie='';await req('/api/state');assert.equal((await req('/api/load',{code:snapshot})).status,200);await idle();assert.equal(field(state,'revision'),savedRevision);assert.notEqual(field(state,'recovery'),recovery);assert.match(state,/<rules matching="true" twos="wild" jokers="true"/);
    assert.match(state,/pileMode="single-lap"/);
    assert.equal((await req('/api/load',{code:'../../etc/passwd'})).status,400);
    assert.equal((await req('/api/load',{code:recovery})).status,200);await idle();
    assert.equal((await req('/portraits/maya.jpg')).status,200);assert.equal((await req('/lib/game.js')).status,404);
    assert.equal((await req('/index.html')).status,200);assert.match(state,/No Ferry Till Monday/);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});

test('failed model pauses the same seat, Retry resumes it, and recovery survives a new server',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'island-retry-'));let failing=true,requests=0;
  const provider=http.createServer(async(req,res)=>{
    let body='';for await(const c of req)body+=c;const context=JSON.parse(JSON.parse(body).messages[1].content);requests++;
    const d={move:failing?9999:context.legalMoves.length?0:-1,say:'The lantern is still going.',memory:'An observation.'};
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(d)}}]}));
  });provider.listen(0,'127.0.0.1');await once(provider,'listening');
  let server=createApp({mode:'api',url:'http://127.0.0.1:'+provider.address().port,model:'fixture',apiFormat:'chat',timeout:2000},{saveDir:dir,turnDelay:0,jokerDelay:0});
  server.listen(0,'127.0.0.1');await once(server,'listening');let url='http://127.0.0.1:'+server.address().port,cookie='',csrf='',state='';
  async function req(path,data){
    const r=await fetch(url+path,{method:data?'POST':'GET',headers:{Cookie:cookie,...(data?{'X-CSRF':csrf}:{})},...(data?{body:new URLSearchParams(data)}:{})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];state=await r.text();csrf=field(state,'csrf')||csrf;assert.equal(r.status,200);return state;
  }
  async function idle(){for(let i=0;i<500;i++){await req('/api/state');if(field(state,'busy')==='0')return;await new Promise(r=>setTimeout(r,3));}throw new Error('Opponent stalled');}
  try{
    await req('/api/state');await req('/api/new',{name:'Camper',count:6});await idle();
    if(field(state,'actor')==='0'){const move=/<move>([^<]+)<\/move>/.exec(state)[1];await req('/api/action',{revision:field(state,'revision'),cards:move});await idle();}
    assert.equal(field(state,'paused'),'1');const actor=field(state,'actor'),revision=field(state,'revision');assert.ok(Number(actor)>0);assert.equal(requests,1);
    failing=false;await req('/api/retry',{revision});await idle();assert.equal(field(state,'paused'),'0');assert.ok(requests>1);assert.notEqual(field(state,'revision'),revision);
    const recovery=field(state,'recovery'),savedRevision=field(state,'revision');
    server.closeAllConnections();await new Promise(r=>server.close(r));
    server=createApp({mode:'local'},{saveDir:dir,turnDelay:0,jokerDelay:0});server.listen(0,'127.0.0.1');await once(server,'listening');url='http://127.0.0.1:'+server.address().port;cookie='';csrf='';
    await req('/api/state');await req('/api/load',{code:recovery});await idle();assert.equal(field(state,'revision'),savedRevision);assert.match(state,/name="Camper"/);
  }finally{
    server.closeAllConnections();await new Promise(r=>server.close(r));provider.closeAllConnections();await new Promise(r=>provider.close(r));await rm(dir,{recursive:true,force:true});
  }
});
