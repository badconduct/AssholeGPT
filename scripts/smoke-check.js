import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const url=process.env.CHECK_URL||'http://127.0.0.1:3084',mode=process.env.CHECK_MODE||'api',file=process.env.SMOKE_STATE_FILE;
if(!file)throw new Error('Set SMOKE_STATE_FILE to a private recovery file.');
let cookie='',csrf='',state='';
const field=(xml,key)=>new RegExp(' '+key+'="([^"]*)"').exec(xml)?.[1];
async function req(path,data,override={}){
  const r=await fetch(url+path,{method:data?'POST':'GET',headers:{Cookie:cookie,...(data?{'X-CSRF':csrf,'Content-Type':'application/x-www-form-urlencoded',Origin:url}:{}),...override},...(data?{body:new URLSearchParams(data)}:{}),signal:AbortSignal.timeout(30000)});
  if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];
  state=await r.text();csrf=field(state,'csrf')||csrf;return r;
}
async function idle(){
  const until=Date.now()+900000;
  while(Date.now()<until){
    await req('/api/state');assert.equal(field(state,'paused'),'0','Opponent paused');
    if(field(state,'busy')==='0'&&Number(field(state,'revealMs'))<=0)return;
    await new Promise(r=>setTimeout(r,1000));
  }
  throw new Error('Opponents did not finish their turns.');
}
assert.equal((await req('/healthz')).status,200);assert.deepEqual(JSON.parse(state),{status:'ok',service:'assholegpt',mode});
assert.equal((await req('/')).status,200);assert.match(state,/<title>AssholeGPT/);assert.match(state,/id="pileMode"/);
for(const asset of ['/images/joker-red-icon.jpg','/images/joker-black-icon-inactive.jpg','/portraits/maya.jpg']){
  const r=await fetch(url+asset);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/jpeg/);
}
await req('/api/state');
if(process.argv.includes('--restore')){
  const saved=JSON.parse(await readFile(file,'utf8'));
  assert.equal((await req('/api/load',{code:saved.code})).status,200);await idle();
  assert.equal(Number(field(state,'revision')),saved.revision);assert.equal(Number(field(state,'round')),saved.round);
  assert.match(state,/pileMode="single-lap"/);assert.match(state,/You cannot finish on a Joker/);
  assert.notEqual(field(state,'recovery'),saved.code);
  console.log('Routed save restored after container recreation; rules and revision preserved.');
}else{
  assert.equal((await req('/api/new',{name:'Deploy check',count:5},{'X-CSRF':'invalid'})).status,400);
  assert.equal((await req('/api/new',{name:'Deploy check',count:5,matching:true,twos:'wild',jokers:true,pileMode:'single-lap'})).status,200);await idle();
  assert.equal(field(state,'actor'),'0');assert.equal((state.match(/<player /g)||[]).length,5);
  const opponents=state.split('<players>')[1].split('</players>')[0].split('</player>').slice(1,5).join('</player>');assert.doesNotMatch(opponents,/<card>/);
  const cards=/<move>([^<]+)<\/move>/.exec(state)?.[1]||'';
  assert.equal((await req('/api/action',{revision:field(state,'revision'),cards})).status,200);await idle();
  assert.equal((await req('/api/save',{})).status,200);
  await writeFile(file,JSON.stringify({code:field(state,'save'),revision:Number(field(state,'revision')),round:Number(field(state,'round'))}),{mode:0o600});
  console.log('Routed health, artwork, CSRF rejection, real opponent play, hidden cards and save passed.');
}
