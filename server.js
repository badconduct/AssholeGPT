import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { createGame, act, nextRound, exchangeCards, returnExchange, publicView, legalMoves, validateGame } from './lib/game.js';
import { configuration, checkConnection, decision, exchangeDecision, quote } from './lib/ai.js';
import { saveStore } from './lib/save-store.js';
import { normalizeRules, ruleSummary, ruleDescriptions } from './lib/rules.js';
const root=fileURLToPath(new URL('.',import.meta.url));
const esc=v=>String(v??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const attrs=o=>Object.entries(o).map(([k,v])=>' '+k+'="'+esc(v)+'"').join('');
export function stateXml(s,extra={}){
  const g=s.game,v=g?publicView(g):null;
  let x='<?xml version="1.0" encoding="UTF-8"?><game'+attrs({tableId:g?.id||'',csrf:s.csrf,phase:g?.phase||'waiting',round:g?.round||0,actor:g?.actor??-1,revision:g?.revision||0,busy:g?.busy?1:0,paused:g?.error?1:0,revealMs:Math.max(0,(g?.revealUntil||0)-Date.now()),recovery:s.code||'',mode:s.mode,save:extra.save||'',exchange:v?.exchange?.count||0})+'>';
  x+='<error>'+esc(extra.error||g?.error||'')+'</error>';
  const rules=normalizeRules(g?.rules);
  x+='<rules'+attrs({...rules,summary:ruleSummary(rules)})+'>'+ruleDescriptions(rules).map(t=>'<rule>'+esc(t)+'</rule>').join('')+'</rules>';
  if(g?.lastTrick){const t=g.lastTrick;x+='<trickResult'+attrs({id:t.id,round:t.round,winner:t.winner,leader:t.leader,rank:t.rank,count:t.count,joker:t.joker?1:0})+'>'+esc(t.description)+'</trickResult>';}
  x+='<players>';
  for(const [i,p]of(v?.players||[]).entries()){
    x+='<player'+attrs({seat:i,id:p.id,name:p.name,count:p.count,role:p.role,score:p.score,wins:p.wins,action:p.action||'',tag:p.tag,bio:p.bio,style:p.style,passed:g.passed.includes(i)?1:0,forfeit:(g.forfeits||[]).includes(i)?1:0,finish:g.order.includes(i)?g.order.indexOf(i)+1:(g.forfeits||[]).includes(i)?g.players.length-g.forfeits.indexOf(i):0})+'>';
    for(const c of p.cards)x+='<card>'+c+'</card>';x+='</player>';
  }
  x+='</players><pile'+attrs({seat:g?.pile?.seat??-1,winner:g?.pile?g.last:-1,start:g?.pileStart??-1})+'>';for(const c of g?.pile?.cards||[])x+='<card>'+c+'</card>';x+='</pile><moves>';
  for(const m of g?.actor===0?legalMoves(g,0):[])x+='<move>'+m.join(',')+'</move>';
  x+='</moves><history>';for(const e of g?.history||[])x+='<event'+attrs({id:e.id})+'>'+esc(e.text)+'</event>';
  x+='</history><talk>';for(const q of g?.talk||[])x+='<line'+attrs({id:q.id,seat:q.seat,name:q.name,round:q.round})+'>'+esc(q.text)+'</line>';
  return x+'</talk><order>'+(g?.order||[]).map(i=>'<seat>'+i+'</seat>').join('')+'</order></game>';
}
export function createApp(config=configuration({}),{saveDir=process.env.SAVE_DIR||join(root,'data','saves'),turnDelay=650,jokerDelay=2200,publicOrigin=process.env.PUBLIC_ORIGIN,secureCookies=process.env.COOKIE_SECURE==='true'}={}){
  if(publicOrigin){const u=new URL(publicOrigin);if(!['http:','https:'].includes(u.protocol)||u.origin!==publicOrigin)throw new Error('PUBLIC_ORIGIN must be an exact HTTP(S) origin.');}
  const sessions=new Map(),owners=new Map(),store=saveStore(saveDir);
  const snap=s=>({version:1,game:{...s.game,busy:false,closed:false,error:'',revealUntil:0}});
  const persist=s=>s.game?store.write(s.code,snap(s)):Promise.resolve();
  function detach(s){if(s.game)s.game.closed=true;if(owners.get(s.code)===s)owners.delete(s.code);}
  function play(g,seat,cards){const before=g.lastTrick;act(g,seat,cards);if(g.lastTrick!==before&&g.lastTrick?.joker)g.revealUntil=Date.now()+jokerDelay;}
  async function pump(s){
    const g=s.game;if(!g||g.busy||g.error||!['playing','exchange'].includes(g.phase)||g.actor<1)return;
    g.busy=true;
    try{
      while(['playing','exchange'].includes(g.phase)&&g.actor>0&&!g.closed){
        if(g.revealUntil>Date.now())await new Promise(r=>setTimeout(r,g.revealUntil-Date.now()));if(g.closed)break;
        if(turnDelay)await new Promise(r=>setTimeout(r,turnDelay));if(g.closed)break;
        const seat=g.actor,exchanging=g.phase==='exchange',d=await (exchanging?exchangeDecision(g,seat,config):decision(g,seat,config));if(g.closed)break;
        if(exchanging)returnExchange(g,seat,d.cards);else play(g,seat,d.cards);
        g.players[seat].memory.push(d.memory);g.players[seat].memory=g.players[seat].memory.slice(-8);
        if(!exchanging)quote(g,seat,!d.cards.length,d.say);await persist(s);
      }
    }catch{if(!g.closed)g.error='Opponent or autosave paused. Press Retry to continue this table.';}
    finally{g.busy=false;}
  }
  function getSession(req,res){
    let id=/(?:^|;\s*)island=([a-f0-9]{48})(?:;|$)/.exec(req.headers.cookie||'')?.[1],s=sessions.get(id);
    if(!s){if(sessions.size>=500)throw new Error('All picnic tables are occupied.');id=randomBytes(24).toString('hex');s={csrf:randomBytes(24).toString('hex'),mode:config.mode,game:null,code:'',at:Date.now(),locked:false};sessions.set(id,s);res.setHeader('Set-Cookie','island='+id+'; Path=/; HttpOnly; SameSite=Lax'+(secureCookies?'; Secure':''));}
    s.at=Date.now();return s;
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    let s,locked=false;
    try{
      const u=new URL(req.url,'http://localhost');
      if(u.pathname==='/healthz'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({status:'ok',service:'assholegpt',mode:config.mode}));}
      if(!u.pathname.startsWith('/api/')){
        if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
        const path=u.pathname==='/'?'/index.html':u.pathname;
        if(!/^\/(?:index\.html|client\.js|style\.css|(?:images|portraits)\/[a-z0-9-]+\.jpg)$/.test(path)){res.writeHead(404);return res.end('Not found');}
        const data=await readFile(join(root,'public',path.slice(1)));
        const ext=path.split('.').pop();res.setHeader('Content-Type',({html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript',jpg:'image/jpeg'})[ext]);
        if(ext==='jpg'){res.setHeader('Cache-Control','public, max-age=86400');res.setHeader('Expires',new Date(Date.now()+86400000).toUTCString());}
        return res.end(req.method==='HEAD'?undefined:data);
      }
      s=getSession(req,res);res.setHeader('Content-Type','text/xml; charset=utf-8');
      if(req.method==='GET'&&u.pathname==='/api/state')return res.end(stateXml(s));
      if(req.method!=='POST'){res.writeHead(405);return res.end(stateXml(s,{error:'Use POST for game actions.'}));}
      if(s.locked)throw new Error('Your last action is still saving. Please wait.');
      const origin=req.headers.origin,expected=publicOrigin||'http'+(secureCookies?'s':'')+'://'+req.headers.host;
      if(origin&&origin!==expected)throw new Error('Request origin did not match.');
      if(req.headers['x-csrf']!==s.csrf)throw new Error('Reload this page before acting.');
      let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)throw new Error('Request too large.');}
      const f=new URLSearchParams(body),extra={};
      if(s.locked)throw new Error('Your last action is still saving. Please wait.');
      s.locked=true;locked=true;
      if(s.game?.busy)throw new Error('Wait for your friend to finish.');
      const g=s.game;
      if(g?.revealUntil>Date.now()&&['/api/action','/api/next'].includes(u.pathname))throw new Error('Joker! Wait for the pile winner announcement.');
      if(['/api/action','/api/exchange','/api/next','/api/retry'].includes(u.pathname)&&(!g||Number(f.get('revision'))!==g.revision))throw new Error('The table changed. Choose again.');
      switch(u.pathname){
        case '/api/new':{
          for(const key of ['matching','jokers'])if(f.has(key)&&!['true','false'].includes(f.get(key)))throw new Error('Invalid house rules.');
          const rules={matching:f.get('matching')==='true',twos:f.get('twos')||'high',jokers:f.get('jokers')==='true',pileMode:f.get('pileMode')||'continuous'};
          const game=createGame(f.get('name')||'You',Number(f.get('count')||6),rules);detach(s);s.game=game;s.code=randomBytes(18).toString('hex');owners.set(s.code,s);break;
        }
        case '/api/action':if(g.error)throw new Error('Press Retry first.');play(g,0,f.get('cards')?f.get('cards').split(','):[]);break;
        case '/api/exchange':exchangeCards(g,(f.get('cards')||'').split(',').filter(Boolean));break;
        case '/api/next':nextRound(g,{deferExchange:config.mode!=='local'});break;
        case '/api/retry':g.error='';break;
        case '/api/save':if(!g)throw new Error('Take a seat first.');extra.save=randomBytes(18).toString('hex');await store.write(extra.save,snap(s));break;
        case '/api/load':{
          const code=f.get('code')||'',saved=await store.read(code);
          if(saved.version!==1)throw new Error('Unsupported save.');validateGame(saved.game);
          const old=owners.get(code);if(old&&old!==s){detach(old);old.game=null;old.code='';}
          detach(s);s.game=saved.game;s.game.closed=false;s.game.busy=false;s.code=randomBytes(18).toString('hex');owners.set(s.code,s);break;
        }
        default:throw new Error('Unknown action.');
      }
      await persist(s);s.locked=false;locked=false;
      // busy is set synchronously, so a second POST cannot race an opponent.
      void pump(s);res.end(stateXml(s,extra));
    }catch(e){
      if(s){res.statusCode=400;res.setHeader('Content-Type','text/xml; charset=utf-8');res.end(stateXml(s,{error:e.message}));}
      else{res.statusCode=404;res.end('Not found');}
    }finally{if(locked)s.locked=false;}
  });
  const cleanup=setInterval(()=>{for(const [id,s]of sessions)if(Date.now()-s.at>86400000&&!s.locked&&!s.game?.busy){detach(s);sessions.delete(id);}},60000);cleanup.unref();server.on('close',()=>{clearInterval(cleanup);for(const s of sessions.values())detach(s);});
  return server;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  const c=configuration();await checkConnection(c);const server=createApp(c);server.listen(Number(process.env.PORT||3084),process.env.HOST||'0.0.0.0',()=>console.log('AssholeGPT - island table ready on port '+(process.env.PORT||3084)));
}
