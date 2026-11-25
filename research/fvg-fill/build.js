// ULTROAN: the FVG fill signals' record on two years of NIFTY 50 5-minute candles (the page's own pipeline: the FVG levels list's gaps, scanZones, the 9/21 daily EMA filter)
const fs=require("fs"), S="/tmp/claude-0/-home-user-Delta/3a78b64f-a132-5d21-ae3b-acf430fd972c/scratchpad";
const FV=require(S+"/swingtree/static/fvg.js"), FS=require(S+"/swingtree/static/fvgsig.js"); const T=FV.Tracker, mins=FV.mins;
const rows=fs.readFileSync(S+"/strat/all5m.csv","utf8").trim().split("\n").slice(1).map(l=>l.split(","));
const days={}; for(const [d,t,o,h,l,c] of rows){ (days[d]=days[d]||[]).push({hm:t,o:+o,h:+h,l:+l,c:+c}); }
const keys=Object.keys(days).sort().filter(k=>days[k].length>=70); const daily=keys.map(k=>({d:k,c:days[k][days[k].length-1].c}));
const out=[];
for(const ema of ["on","off"]) for(let i=21;i<keys.length;i++){ const cs=days[keys[i]]; const bars=cs.map(x=>({d:keys[i],t:mins(x.hm),o:x.o,h:x.h,l:x.l,c:x.c,time:mins(x.hm)*60}));
  const cfg=Object.assign({},FS.DEFAULTS,{ema_filter:ema}); const tr=new T({},5); tr.update(cs,"d");
  const zones=tr.made_today.map(g=>({id:g.id,i:bars.findIndex(b=>b.t===mins(g.made_hm)-5),side:g.kind==="bullish"?1:-1,lo:g.bottom,hi:g.top,mid:(g.bottom+g.top)/2})).filter(z=>z.i>=0);
  const dl=daily.filter(x=>x.d<keys[i]); const trend=ema==="on"?FS.trendDirection(bars,cfg,dl):null; const atrs=FS.atr(bars,14);
  const {signals}=FS.scanZones(bars,zones,Object.assign({},cfg,{interval:5,carry_days:0}),trend,null);
  const dayOpen=bars[0].o; let dh=-1e9,dl2=1e9; const hi=[],lo=[]; bars.forEach(b=>{dh=Math.max(dh,b.h);dl2=Math.min(dl2,b.l);hi.push(dh);lo.push(dl2);});
  for(const s of signals){ const k=s.i, dir=s.action==="BUY CE"?1:-1, e=s.entry, b=bars[k], z=zones.find(z=>z.i===s.zone_i)||{}; const width=s.zone_hi-s.zone_lo, a=atrs[k]||atrs[k-1]||null;
    const at=n=>bars[Math.min(bars.length-1,k+n)].c, endc=bars[bars.length-1].c; let mae=0; for(let j=k+1;j<bars.length;j++) mae=Math.min(mae,dir*((dir>0?bars[j].l:bars[j].h)-e));
    // a plain trade: stop 1 ATR against, target 1.5 ATR for, from the next candle; whichever is hit first (a candle that holds both: the stop); else the day's close
    let tp=null; if(a){ const stop=e-dir*a, tgt=e+dir*1.5*a; tp=dir*(endc-e); for(let j=k+1;j<bars.length;j++){ const hit_s=dir>0?bars[j].l<=stop:bars[j].h>=stop, hit_t=dir>0?bars[j].h>=tgt:bars[j].l<=tgt; if(hit_s){tp=-a;break;} if(hit_t){tp=1.5*a;break;} } }
    out.push({ema,d:keys[i],y:keys[i]<"2025-11-11"?1:2,dir,t:b.t,age:k-s.zone_i,width:a?width/a:null,depth:dir>0?(s.zone_lo-b.l)/width:(b.h-s.zone_hi)/width,color:(b.c>b.o)===(dir>0)?1:0,closePos:dir>0?(b.c-b.l)/((b.h-b.l)||1):(b.h-b.c)/((b.h-b.l)||1),dayPos:(e-lo[k])/((hi[k]-lo[k])||1),gapPct:(e-dayOpen)/dayOpen*100,dow:new Date(keys[i]).getUTCDay(),p6:dir*(at(6)-e),p12:dir*(at(12)-e),pend:dir*(endc-e),mae,tp}); } }
fs.writeFileSync(S+"/fvgstudy/signals.json",JSON.stringify(out)); console.log("signals",out.length,"ema on",out.filter(x=>x.ema==="on").length,"off",out.filter(x=>x.ema==="off").length);
