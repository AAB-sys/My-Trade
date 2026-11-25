const fs=require("fs"), S="/tmp/claude-0/-home-user-Delta/3a78b64f-a132-5d21-ae3b-acf430fd972c/scratchpad"; const all=JSON.parse(fs.readFileSync(S+"/fvgstudy/signals.json"));
const F={ time:[["<10:30",x=>x.t<630],["10:30-12:00",x=>x.t>=630&&x.t<720],["12:00-13:30",x=>x.t>=720&&x.t<810],[">=13:30",x=>x.t>=810]],
 age:[["age<=3",x=>x.age<=3],["age4-10",x=>x.age>3&&x.age<=10],["age>10",x=>x.age>10]],
 width:[["gap<0.5ATR",x=>x.width<0.5],["gap0.5-1",x=>x.width>=0.5&&x.width<1],["gap>=1ATR",x=>x.width>=1]],
 depth:[["wick<0.25 beyond",x=>x.depth<0.25],["wick0.25-1",x=>x.depth>=0.25&&x.depth<1],["wick>=1 beyond",x=>x.depth>=1]],
 color:[["fill candle with signal",x=>x.color===1],["fill candle against",x=>x.color===0]],
 closePos:[["close in top 70%+ of range",x=>x.closePos>=0.7],["close < 70%",x=>x.closePos<0.7]],
 dayPos:[["entry in day's lower third",x=>x.dayPos<1/3],["middle",x=>x.dayPos>=1/3&&x.dayPos<2/3],["upper third",x=>x.dayPos>=2/3]],
 openGap:[["day gapped up >0.3%",x=>x.gapPct>0.3],["flat",x=>Math.abs(x.gapPct)<=0.3],["gapped down",x=>x.gapPct<-0.3]],
 side:[["CE",x=>x.dir>0],["PE",x=>x.dir<0]], ema:[["trend filter ON",x=>x.ema==="on"],["trend filter OFF",x=>x.ema==="off"]] };
const st=(a)=>{ const n=a.length; if(!n) return {n:0,tp:0,w:0,p12:0,pend:0}; const s=f=>a.reduce((q,x)=>q+(x[f]||0),0); return {n,tp:s("tp"),w:Math.round(100*a.filter(x=>x.tp>0).length/n),p12:s("p12")/n,pend:s("pend")/n}; };
const base=all.filter(x=>x.ema==="on"); const show=(label,a)=>{const y1=st(a.filter(x=>x.y===1)),y2=st(a.filter(x=>x.y===2)); return {label,n1:y1.n,n2:y2.n,tp1:Math.round(y1.tp),tp2:Math.round(y2.tp),w1:y1.w,w2:y2.w,p12_1:+y1.p12.toFixed(1),p12_2:+y2.p12.toFixed(1)};};
console.log("ALL (trend filter on):",JSON.stringify(show("all",base)));
console.log("ALL (trend filter off):",JSON.stringify(show("all off",all.filter(x=>x.ema==="off"))));
let tried=0; const good=[]; const rows=[];
const feats=Object.keys(F).filter(k=>k!=="ema");
const tests=[]; for(const k of feats) for(const [n,f] of F[k]) tests.push([[n],[f]]); for(let i=0;i<feats.length;i++) for(let j=i+1;j<feats.length;j++) for(const [n1,f1] of F[feats[i]]) for(const [n2,f2] of F[feats[j]]) tests.push([[n1,n2],[f1,f2]]);
for(const [names,fs_] of tests){ tried++; const a=base.filter(x=>fs_.every(f=>f(x))); const r=show(names.join(" + "),a); rows.push(r); if(r.n1>=25&&r.n2>=25&&r.tp1>0&&r.tp2>0&&r.p12_1>0&&r.p12_2>0) good.push(r); }
console.log("variants tried:",tried,"| both years positive with >=25 signals a year:",good.length);
good.sort((a,b)=>(b.tp1+b.tp2)-(a.tp1+a.tp2)); good.slice(0,8).forEach(r=>console.log(JSON.stringify(r)));
// by chance: how many of the same size would be positive in both years if the signals were coin flips? shuffle test
let hit=0, runs=200; for(let r=0;r<runs;r++){ const sh=base.map(x=>({...x})); const ys=sh.map(x=>x.y); for(let i=ys.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ys[i],ys[j]]=[ys[j],ys[i]];} sh.forEach((x,i)=>x.y=ys[i]); let g=0; for(const [names,fs_] of tests){ const a=sh.filter(x=>fs_.every(f=>f(x))); const y1=st(a.filter(x=>x.y===1)),y2=st(a.filter(x=>x.y===2)); if(y1.n>=25&&y2.n>=25&&y1.tp>0&&y2.tp>0&&y1.p12>0&&y2.p12>0) g++; } hit+=g; }
console.log("by luck alone (years shuffled), about",(hit/runs).toFixed(1),"such combinations appear among the",tried,"variants");
