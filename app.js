const SUITS=["♠","♥","♦","♣"], RED=new Set(["♥","♦"]);
const RANKS=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
let state, history=[], timer=null, startTime=0, selected=null;
const $=id=>document.getElementById(id);

function card(s,r,up=false){return {id:s+r+Math.random().toString(36).slice(2),s,r,up};}
function freshDeck(){
  let d=[]; for(const s of SUITS) for(const r of RANKS)d.push(card(s,r));
  for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]]} return d;
}
function newGame(){
  state={tableau:[[],[],[],[],[],[],[]],stock:[],waste:[],found:[[],[],[],[]],score:0,moves:0,redeals:0,won:false};
  history=[]; selected=null; let d=freshDeck();
  for(let c=0;c<7;c++)for(let row=0;row<=c;row++){let x=d.pop();x.up=row===c;state.tableau[c].push(x)}
  state.stock=d; startTime=Date.now(); if(timer)clearInterval(timer); timer=setInterval(updateTime,1000); render();
}
function snapshot(){history.push(JSON.stringify(state)); if(history.length>100)history.shift()}
function restore(){if(!history.length)return;state=JSON.parse(history.pop());selected=null;render()}
function rankVal(r){return RANKS.indexOf(r)+1}
function canStack(a,b){return RED.has(a.s)!==RED.has(b.s)&&rankVal(a.r)===rankVal(b.r)-1}
function canFoundation(c,f){return f.length===0?c.r==="A":f[f.length-1].s===c.s&&rankVal(c.r)===rankVal(f[f.length-1].r)+1}
function flipIfNeeded(col){if(col.length && !col[col.length-1].up){col[col.length-1].up=true;state.score+=5}}
function moveScore(n){if(settings().scoreMode!=="none")state.score+=n}
function settings(){return JSON.parse(localStorage.getItem("solitaire-settings")||'{"hints":true,"auto":true,"sound":false,"scoreMode":"standard","theme":"green"}')}
function saveSettings(o){localStorage.setItem("solitaire-settings",JSON.stringify(o))}
function touchPile(type,i,e){
  const pile=type==="t"?state.tableau[i]:(type==="w"?state.waste:state.found[i]);
  if(type==="t"){
    const rect=e.currentTarget.getBoundingClientRect(); const y=e.clientY-rect.top;
    let idx=Math.floor(y/Math.max(35,Math.min(95,rect.width*1.38))); if(idx>=pile.length)idx=pile.length-1;
    if(idx>=0 && pile[idx].up) handleSelection(type,i,idx);
    else if(pile.length && pile[pile.length-1].up) handleSelection(type,i,pile.length-1);
  } else if(pile.length) handleSelection(type,i,pile.length-1);
}
function handleSelection(type,i,idx){
  if(type==="t" && !state.tableau[i][idx].up)return;
  if(!selected){
    if(type==="t"){
      const p=state.tableau[i]; if(!p[idx].up)return;
      // only a descending alternating face-up run can be picked up
      for(let k=idx+1;k<p.length;k++) if(!canStack(p[k],p[k-1]))return;
    }
    selected={type,i,idx}; render(); return;
  }
  if(selected.type==="t" && type==="t" && selected.i===i && selected.idx===idx){selected=null;render();return}
  if(tryMove(selected,type,i,idx)){selected=null;render();checkWin()}
  else {selected={type,i,idx};render()}
}
function takeSelected(){
  if(!selected)return null;
  const src=selected.type==="t"?state.tableau[selected.i]:(selected.type==="w"?state.waste:state.found[selected.i]);
  if(selected.type==="t")return src.splice(selected.idx);
  return [src.pop()];
}
function putRun(type,i,run){
  const p=type==="t"?state.tableau[i]:(type==="w"?state.waste:state.found[i]); p.push(...run);
}
function tryMove(sel,to,ti,idx){
  let src=sel.type==="t"?state.tableau[sel.i]:(sel.type==="w"?state.waste:state.found[sel.i]);
  if(!src.length)return false;
  const run=sel.type==="t"?src.slice(sel.idx):[src[src.length-1]];
  const first=run[0];
  if(to==="t"){
    const dest=state.tableau[ti];
    if(dest.length===0 ? first.r==="K" : canStack(first,dest[dest.length-1])){
      snapshot(); takeSelected(); putRun("t",ti,run); if(sel.type==="t")flipIfNeeded(src); moveScore(sel.type==="w"?5:0);state.moves++;return true;
    }
  }
  if(to==="f" && run.length===1 && canFoundation(first,state.found[ti])){
    snapshot();takeSelected();putRun("f",ti,run);if(sel.type==="t")flipIfNeeded(src);moveScore(10);state.moves++;return true;
  }
  return false;
}
function stockTap(){
  if(state.stock.length){
    snapshot();
    const c=state.stock.pop();
    c.up=true;
    state.waste.push(c);
    state.moves++;
    render();
    return;
  }
  if(state.waste.length){
    snapshot();
    state.stock=state.waste.reverse();
    state.stock.forEach(c=>c.up=false);
    state.waste=[];
    state.redeals++;
    render();
  }
}
function autoMove(){
  let moved=true;
  while(moved){moved=false;
    for(let i=0;i<7;i++){let p=state.tableau[i],c=p[p.length-1];if(c&&c.up){for(let f=0;f<4;f++)if(canFoundation(c,state.found[f])){snapshot();state.found[f].push(p.pop());flipIfNeeded(p);state.score+=10;state.moves++;moved=true;break}}}
    let c=state.waste.at(-1); if(c){for(let f=0;f<4;f++)if(canFoundation(c,state.found[f])){snapshot();state.found[f].push(state.waste.pop());state.score+=10;state.moves++;moved=true;break}}
  } render();checkWin()
}
function hint(){
  const s=settings(); if(!s.hints)return;
  for(let i=0;i<7;i++){let p=state.tableau[i],c=p.at(-1);if(c&&c.up)for(let f=0;f<4;f++)if(canFoundation(c,state.found[f]))return flash("Try moving "+c.r+c.s+" to a foundation.");
  }
  let w=state.waste.at(-1);if(w)for(let i=0;i<7;i++){let p=state.tableau[i];if(p.length?canStack(w,p.at(-1)):w.r==="K")return flash("Try moving "+w.r+w.s+" onto the tableau.");}
  for(let a=0;a<7;a++)for(let b=0;b<7;b++)if(a!==b){let pa=state.tableau[a],pb=state.tableau[b],c=pa.at(-1);if(c&&c.up&&pb.length&&canStack(c,pb.at(-1)))return flash("Try moving "+c.r+c.s+" onto another tableau pile.")}
  flash("No obvious move — try drawing a card.")
}
function flash(t){$("message").textContent=t;$("message").style.display="block";setTimeout(()=>$("message").style.display="none",1800)}
function checkWin(){if(state.found.every(f=>f.length===13)){state.won=true;flash("🎉 You won!");}}
function cardEl(c,selectedNow=false){
 const d=document.createElement("div");d.className="card"+(RED.has(c.s)?" red":"")+(c.up?"":" back");if(selectedNow)d.style.outline="3px solid var(--accent)";
 if(c.up)d.innerHTML=`<div><span class="rank">${c.r}</span><span class="suit">${c.s}</span></div><div class="center">${c.s}</div><div style="text-align:right"><span class="rank">${c.r}</span><span class="suit">${c.s}</span></div>`;
 return d;
}
function render(){
 const t=$("top");t.innerHTML="";
 const stock=document.createElement("div");stock.className="pile";stock.onclick=stockTap;
 if(state.stock.length)stock.appendChild(cardEl({up:false}));else{let s=document.createElement("div");s.className="slot";stock.appendChild(s)}
 t.appendChild(stock);
 const waste=document.createElement("div");waste.className="pile";waste.onclick=()=>state.waste.length&&handleSelection("w",0,state.waste.length-1);
 if(state.waste.length)waste.appendChild(cardEl(state.waste.at(-1),selected?.type==="w"));else{let s=document.createElement("div");s.className="slot";waste.appendChild(s)}t.appendChild(waste);
 for(let i=0;i<5;i++){const p=document.createElement("div");p.className="pile";p.dataset.i=i+2;p.style.visibility=i<1?"hidden":"visible";t.appendChild(p)}
 for(let i=0;i<4;i++){const p=document.createElement("div");p.className="pile";p.onclick=()=>{};let f=state.found[i];if(f.length)p.appendChild(cardEl(f.at(-1)));else{let s=document.createElement("div");s.className="slot";s.innerHTML=`<div style="text-align:center;padding-top:20%;opacity:.35;font-size:24px">${SUITS[i]}</div>`;p.appendChild(s)}t.appendChild(p)}
 const tab=$("tableau");tab.innerHTML="";
 for(let i=0;i<7;i++){const col=document.createElement("div");col.className="tcol";col.dataset.i=i;
   if(!state.tableau[i].length){let s=document.createElement("div");s.className="slot";col.appendChild(s)}
   state.tableau[i].forEach((c,j)=>{const e=cardEl(c,selected?.type==="t"&&selected.i===i&&selected.idx===j);e.style.top=(j*(window.innerWidth<700?Math.min(72,window.innerWidth*.16):74))+"px";e.style.height=(window.innerWidth<700?Math.min(105,window.innerWidth*.20):105)+"px";e.onclick=(ev)=>{ev.stopPropagation();handleSelection("t",i,j)};col.appendChild(e)});
   tab.appendChild(col)
 }
 $("score").textContent=state.score;$("moves").textContent=state.moves;updateTime()
}
function updateTime(){if(!startTime)return;let sec=Math.floor((Date.now()-startTime)/1000);$("time").textContent=Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0")}
$("newBtn").onclick=()=>{if(confirm("Start a new game?"))newGame()}
$("undoBtn").onclick=restore;$("hintBtn").onclick=hint;$("autoBtn").onclick=autoMove;
$("settingsBtn").onclick=()=>{$("modal").style.display="flex";let s=settings();$("hintToggle").checked=s.hints;$("autoToggle").checked=s.auto;$("soundToggle").checked=s.sound;$("scoreMode").value=s.scoreMode;$("theme").value=s.theme}
$("closeSettings").onclick=()=>{$("modal").style.display="none";applySettings()}
function applySettings(){let s={hints:$("hintToggle").checked,auto:$("autoToggle").checked,sound:$("soundToggle").checked,scoreMode:$("scoreMode").value,theme:$("theme").value};saveSettings(s);document.documentElement.style.setProperty("--felt",s.theme==="blue"?"#155aa0":s.theme==="dark"?"#252525":"#0b6b4f");render()}
document.addEventListener("keydown",e=>{if(e.key.toLowerCase()==="n")newGame();if(e.key.toLowerCase()==="u")restore();if(e.key.toLowerCase()==="h")hint()});
if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
applySettings();newGame();
