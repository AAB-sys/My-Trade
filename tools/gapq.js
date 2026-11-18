// Question G1 (18 Nov): the day opens outside yesterday's value area (profile by time, 30 rows, 70%). Does it stay out?
"use strict"; const fs=require("fs");
const byDay={}; for (const [d,t,o,h,l,c] of fs.readFileSync(__dirname+"/all5m.csv","utf8").trim().split("\n").slice(1).map(x=>x.split(","))) (byDay[d]=byDay[d]||[]).push({hm:t.slice(0,5),open:+o,high:+h,low:+l,close:+c});
const dates=Object.keys(byDay).sort().filter(x=>byDay[x].length>=70);
function va(b){let lo=Infinity,hi=-Infinity;for(const x of b){lo=Math.min(lo,x.low);hi=Math.max(hi,x.high);}const n=30,step=Math.max((hi-lo)/n,0.05),v=new Array(n).fill(0),at=p=>Math.max(0,Math.min(n-1,Math.floor((p-lo)/step)));
 for(const x of b)for(let r=at(x.low);r<=at(x.high);r++)v[r]++;let poc=v.indexOf(Math.max(...v)),up=poc,dn=poc,acc=v[poc];const tot=v.reduce((a,x)=>a+x,0);
 while(acc<tot*0.7&&(up<n-1||dn>0)){const u=up<n-1?v[up+1]:-1,d=dn>0?v[dn-1]:-1;if(u>=d){up++;acc+=u;}else{dn--;acc+=d;}}return{val:lo+dn*step,vah:lo+(up+1)*step,poc:lo+(poc+0.5)*step};}
const T={}; const add=(k,v)=>{const t=T[k]=T[k]||{n:0};t[v]=(t[v]||0)+1;t.n++;};
const pos=(p,y)=>p>y.vah?"above":p<y.val?"below":"inside";
for(let i=1;i<dates.length;i++){const y=va(byDay[dates[i-1]]),b=byDay[dates[i]],op=b[0].open,w=pos(op,y),cl=b[b.length-1].close;
 add("open "+w+": the close", pos(cl,y)); if(w==="inside")continue;
 const sgn=w==="above"?1:-1, edge=sgn>0?y.vah:y.val;
 // did it get back into yesterday's value (touch the edge) during the day, and when first
 const k=b.findIndex(x=>sgn>0?x.low<=edge:x.high>=edge);
 add("open "+w+": touched the edge again", k<0?"never":b[k].hm<"10:15"?"in the first hour":b[k].hm<"12:00"?"10:15-12:00":"afternoon");
 for(const at of ["09:45","10:15","11:15"]){const j=b.findIndex(x=>x.hm>=at)-1, still=b.slice(0,j+1).every(x=>sgn>0?x.low>edge:x.high<edge);
   if(still){add(`open ${w}, edge untouched to ${at}: the close`,pos(cl,y)); add(`open ${w}, edge untouched to ${at}: from then to the close`, sgn*(cl-b[j].close)>0?"went further":"came back");
     add(`open ${w}, edge untouched to ${at}: touched the edge later`, b.slice(j+1).some(x=>sgn>0?x.low<=edge:x.high>=edge)?"yes":"no");}
   else if(at==="10:15"){ // back inside in the first hour: reaches yesterday's POC?
     add(`open ${w}, back at the edge before 10:15: reached yesterday's POC`, b.some(x=>x.low<=y.poc&&x.high>=y.poc)?"yes":"no"); add(`open ${w}, back at the edge before 10:15: the close`,pos(cl,y)); } }
}
console.log(`days ${dates.length-1} (${dates[1]} to ${dates[dates.length-1]})`);
for(const k of Object.keys(T).sort()){const t=T[k];console.log(k+`  n ${t.n}: `+Object.keys(t).filter(x=>x!=="n").sort((a,b)=>t[b]-t[a]).map(x=>`${x} ${Math.round(100*t[x]/t.n)}%`).join(", "));}
