import {initialize} from '../../../assets/js/common.js';
import {language} from '../../../assets/js/i18n.js';
import katex from '../../../assets/vendor/katex/katex.mjs';
import {createDefaults,presets,validate,fieldAt,coordinates,seeds,traceLine,logRange,equipotentialLevels,contourSegments,MAX_CHARGES} from './model.js';
import {blocks} from './equations.js';

const $=id=>document.getElementById(id),canvas=$('plot'),ctx=canvas.getContext('2d');
let dictionaries={},s=createDefaults(),loaded=false,W=800,H=571,dirty=true,dragging=null,range={low:0,high:2};
const probe={x:0,y:.6};
const tr=(key,values={})=>Object.entries(values).reduce((text,[name,value])=>text.replaceAll('{'+name+'}',String(value)),dictionaries[language]?.[key]??dictionaries.en?.[key]??key);
const num=x=>{if(!Number.isFinite(x))return '—';if(Math.abs(x)<1e-12)return '0';return new Intl.NumberFormat(language,{maximumSignificantDigits:4,notation:Math.abs(x)>=1e4||Math.abs(x)<.001?'scientific':'standard'}).format(x);};
const xy=(px,py)=>({x:(px/W-.5)*s.extent,y:(.5-py/H)*s.extent*H/W});
const pixel=(x,y)=>({x:W*(.5+x/s.extent),y:H/2-y*W/s.extent});

function chargeList(){
 const el=$('charge-list');el.replaceChildren();
 s.charges.forEach((c,i)=>{
  const row=document.createElement('div');row.className='chargeitem';
  const dot=document.createElement('span');dot.className='dot'+(c.q<0?' neg':'');dot.textContent=c.q<0?'−':'+';
  const input=document.createElement('input');input.type='number';input.min=-20;input.max=20;input.step='any';input.value=c.q;input.setAttribute('aria-label',tr('chargeAria',{n:i+1}));
  input.onchange=()=>{const q=input.valueAsNumber;if(!Number.isFinite(q)||Math.abs(q)>20){input.value=c.q;return;}c.q=q;chargeList();dirty=true;};
  const del=document.createElement('button');del.type='button';del.textContent='×';del.setAttribute('aria-label',tr('removeCharge',{n:i+1}));
  del.onclick=()=>{s.charges.splice(i,1);chargeList();dirty=true;};
  row.append(dot,input,del);el.append(row);
 });
 for(const id of ['add-positive','add-negative'])$(id).disabled=s.charges.length>=MAX_CHARGES;
}
function preset(){s.charges=presets[$('preset').value].map(c=>({...c}));chargeList();dirty=true;}
function math(){
 const container=$('math');container.replaceChildren();
 for(const [kind,value] of blocks(s)){
  const node=document.createElement(kind==='h'?'h3':kind==='p'?'p':'div');
  if(kind==='eq'){node.className='eq';katex.render(value,node,{displayMode:true,throwOnError:false,trust:false,output:'htmlAndMathml'});}
  else node.textContent=tr(value);
  container.append(node);
 }
 $('tag').textContent=tr('tag');
}
function controls(){
 s.mode=$('mode').value;
 $('point-controls').hidden=s.mode!=='charges';$('strength-group').hidden=s.mode==='charges';$('sphere-controls').hidden=s.mode!=='sphere';$('wire-controls').hidden=s.mode!=='wire';$('plates-controls').hidden=s.mode!=='plates';
 $('strength-label').textContent=tr(s.mode==='wire'?'lambda':s.mode==='plates'?'sigma':'q');
 $('strength-value').textContent=num(s.strength)+(s.mode==='wire'?' nC/m':s.mode==='plates'?' nC/m²':' nC');
 $('radius-value').textContent=num(s.radius)+' m';$('separation-value').textContent=num(s.separation)+' m';
}
function translate(){
 document.querySelectorAll('[data-m]').forEach(el=>{el.textContent=tr(el.dataset.m);});
 document.querySelectorAll('[data-m-aria]').forEach(el=>el.setAttribute('aria-label',tr(el.dataset.mAria)));
 document.title=tr('title')+' · EEVL';
 chargeList();controls();math();dirty=true;
}
function arrow(x,y,dx,dy,length,color,width=1){
 const m=Math.hypot(dx,dy);if(!(m>1e-14))return;
 const ux=dx/m,uy=-dy/m;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=width;
 ctx.beginPath();ctx.moveTo(x-ux*length*.4,y-uy*length*.4);ctx.lineTo(x+ux*length*.6,y+uy*length*.6);ctx.stroke();
 const tx=x+ux*length*.6,ty=y+uy*length*.6;
 ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(tx-ux*5-uy*3,ty-uy*5+ux*3);ctx.lineTo(tx-ux*5+uy*3,ty-uy*5-ux*3);ctx.closePath();ctx.fill();
}
const STOPS=[[7,26,45],[16,76,119],[20,139,159],[70,193,174],[248,215,122]];
function color(z){z=Math.max(0,Math.min(.9999,z))*4;const i=Math.floor(z),a=z-i;return STOPS[i].map((v,j)=>Math.round(v*(1-a)+STOPS[i+1][j]*a));}
function background(){
 ctx.fillStyle='#091a2a';ctx.fillRect(0,0,W,H);
 const small=document.createElement('canvas');small.width=140;small.height=Math.round(140*H/W);
 const c=small.getContext('2d'),image=c.createImageData(small.width,small.height),data=[];
 for(let j=0;j<small.height;j++)for(let i=0;i<small.width;i++){const p=xy((i+.5)*W/small.width,(j+.5)*H/small.height);data.push(fieldAt(p.x,p.y,s).magnitude);}
 range=logRange(data);
 if($('heat').checked){
  data.forEach((v,i)=>{const z=v>1e-12?(Math.log10(v)-range.low)/(range.high-range.low):0;image.data.set([...color(Number.isFinite(z)?z:1),255],4*i);});
  c.putImageData(image,0,0);ctx.drawImage(small,0,0,W,H);
 }
 $('scale-legend').textContent=tr('scale')+' · '+num(10**range.low)+' → '+num(10**range.high)+' V/m';
}
function axes(){
 const step=s.extent<=4?.5:1;ctx.strokeStyle='#cde5ff20';ctx.lineWidth=1;ctx.fillStyle='#d6e8f0bb';ctx.font='11px system-ui';ctx.textAlign='left';
 for(let x=-s.extent/2;x<=s.extent/2+.01;x+=step){const p=pixel(x,0);ctx.beginPath();ctx.moveTo(p.x,0);ctx.lineTo(p.x,H);ctx.stroke();if(Math.abs(x)>1e-9)ctx.fillText(num(x),p.x+3,H/2+15);}
 const half=s.extent*H/W/2;
 for(let y=Math.ceil(-half/step)*step;y<=half;y+=step){const p=pixel(0,y);ctx.beginPath();ctx.moveTo(0,p.y);ctx.lineTo(W,p.y);ctx.stroke();if(Math.abs(y)>1e-10)ctx.fillText(num(y),W/2+5,p.y-3);}
 ctx.strokeStyle='#e1f2ff70';ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();
 ctx.fillStyle='#fff';ctx.fillText('x (m)',W-39,H/2-8);ctx.fillText('y (m)',W/2+8,15);ctx.fillText('O',W/2+5,H/2+15);
}
function sources(){
 ctx.textAlign='left';
 if(s.mode==='charges')for(const c of s.charges){
  const p=pixel(c.x,c.y);ctx.beginPath();ctx.arc(p.x,p.y,12,0,2*Math.PI);ctx.fillStyle=c.q>=0?'#ef6377':'#399fef';ctx.fill();ctx.strokeStyle='#ffffffcc';ctx.lineWidth=1.5;ctx.stroke();
  ctx.fillStyle='white';ctx.font='bold 18px system-ui';ctx.textAlign='center';ctx.fillText(c.q>=0?'+':'−',p.x,p.y+6);ctx.font='11px system-ui';ctx.fillText(num(c.q)+' nC',p.x,p.y-19);ctx.textAlign='left';
 }
 if(s.mode==='sphere'){ctx.beginPath();ctx.arc(W/2,H/2,s.radius*W/s.extent,0,2*Math.PI);ctx.fillStyle=s.material==='conductor'?'#98bdd530':'#73e0c216';ctx.fill();ctx.strokeStyle='#e6f7ff';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff';ctx.font='11px system-ui';ctx.fillText('R = '+num(s.radius)+' m',W/2+6,H/2-8);}
 if(s.mode==='wire'){ctx.fillStyle='#ffcc71';ctx.beginPath();ctx.arc(W/2,H/2,7,0,2*Math.PI);ctx.fill();ctx.fillStyle='#fff';ctx.font='11px system-ui';ctx.fillText(tr('wireMarker'),W/2+11,H/2-10);}
 if(s.mode==='plates')for(const side of [-1,1]){
  const p=pixel(side*s.separation/2,0),positive=side*s.strength<=0;
  ctx.strokeStyle=positive?'#ef6377':'#399fef';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(p.x,0);ctx.lineTo(p.x,H);ctx.stroke();
  ctx.fillStyle='white';ctx.font='bold 16px system-ui';for(let y=30;y<H;y+=65)ctx.fillText(positive?'+':'−',p.x+8,y);
 }
}
function streamlines(){
 if(!$('lines').checked)return;
 const half=s.extent*H/W/2;ctx.strokeStyle='#eafaff70';ctx.lineWidth=1;
 for(const seed of seeds(s,half)){
  const points=traceLine(seed,s,{halfWidth:s.extent/2,halfHeight:half});
  ctx.beginPath();points.forEach(([x,y],j)=>{const p=pixel(x,y);if(j)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.stroke();
 }
}
function equipotentials(){
 if(!$('equip').checked)return;
 const n=64,m=Math.max(30,Math.round(n*H/W)),grid=[],values=[];
 for(let j=0;j<=m;j++){const row=[];for(let i=0;i<=n;i++){const p=xy(i*W/n,j*H/m),v=fieldAt(p.x,p.y,s).v;row.push(v);values.push(v);}grid.push(row);}
 ctx.strokeStyle='#fff9d099';ctx.lineWidth=1;ctx.setLineDash([4,4]);
 for(const level of equipotentialLevels(values,11)){
  ctx.beginPath();
  for(const [a,b] of contourSegments(grid,level)){ctx.moveTo(a[0]*W/n,a[1]*H/m);ctx.lineTo(b[0]*W/n,b[1]*H/m);}
  ctx.stroke();
 }
 ctx.setLineDash([]);
}
function vectors(){
 if(!$('vectors').checked)return;
 const count=+$('density').value,step=W/count;
 for(let x=step/2;x<W;x+=step)for(let y=step/2;y<H;y+=step){
  const p=xy(x,y);
  if(s.mode==='charges'&&s.charges.some(c=>Math.hypot(c.x-p.x,c.y-p.y)<s.extent/W*18))continue;
  const f=fieldAt(p.x,p.y,s);arrow(x,y,f.ex,f.ey,step*.57,'#eefcffb0',1);
 }
}
function selectedCoords(){const v=$('coord-system').value;return v==='auto'?(s.mode==='sphere'?'sph':s.mode==='wire'?'cyl':'cart'):v;}
function probeReadout(){
 const f=fieldAt(probe.x,probe.y,s),pos=coordinates(probe.x,probe.y,f),m=f.magnitude,kind=selectedCoords(),r=pos.rho,defined=r>1e-12;
 $('mag').textContent=num(m);$('components').textContent=num(f.ex)+' / '+num(f.ey);$('potential').textContent=num(f.v);
 $('angle').textContent=m>1e-12?num(Math.atan2(f.ey,f.ex)*180/Math.PI):'—';
 $('cart-label').textContent=tr('cartAlways');$('cart-coords').textContent='(x, y, z) = ('+num(probe.x)+', '+num(probe.y)+', 0) m';
 $('native-label').textContent=tr('selected')+' · '+tr(kind);
 $('native-coords').textContent=kind==='cart'?'x = '+num(probe.x)+' m · y = '+num(probe.y)+' m · z = 0 m':kind==='cyl'?'ρ = '+num(r)+' m · φ = '+num(pos.phiDegrees)+'° · z = 0 m':'r = '+num(r)+' m · θ = '+(defined?'90':'—')+'° · φ = '+num(pos.phiDegrees)+'°';
 $('native-field').textContent=tr('basis')+': '+(kind==='cart'?'Eₓ = '+num(f.ex)+' · Eᵧ = '+num(f.ey)+' · E𝓏 = 0':kind==='cyl'?'Eρ = '+num(pos.radial)+' · Eφ = '+num(pos.azimuthal)+' · E𝓏 = 0':'Eᵣ = '+num(pos.radial)+' · Eθ = '+(f.singular||!defined?'—':'0')+' · Eφ = '+num(pos.azimuthal))+' V/m';
 const p=pixel(probe.x,probe.y),out=p.x<0||p.x>W||p.y<0||p.y>H;
 $('notice').textContent=f.singular?tr('singular'):f.boundary?tr('boundary'):out?tr('clipped'):m<1e-12?tr('zero'):'';
 if(out)return;
 ctx.strokeStyle='#ffdd73';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(p.x,H/2);ctx.lineTo(p.x,p.y);ctx.lineTo(W/2,p.y);ctx.stroke();ctx.setLineDash([]);
 ctx.strokeStyle='#ffe28a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.stroke();
 arrow(p.x,p.y,f.ex,f.ey,55,'#ffdf75',3);ctx.fillStyle='#ffe89c';ctx.font='bold 12px system-ui';ctx.textAlign='left';ctx.fillText('P',p.x+10,p.y-10);
 if(kind!=='cart'&&defined){
  arrow(p.x,p.y,probe.x,probe.y,29,'#98f3de',1.5);arrow(p.x,p.y,-probe.y,probe.x,29,'#f3b4ff',1.5);
  const a=pixel(probe.x+.25*probe.x/r,probe.y+.25*probe.y/r),b=pixel(probe.x-.25*probe.y/r,probe.y+.25*probe.x/r);
  ctx.fillStyle='#98f3de';ctx.fillText(kind==='cyl'?'eρ':'eᵣ',a.x+5,a.y);ctx.fillStyle='#f3b4ff';ctx.fillText('eφ',b.x+5,b.y);
 }
}
function render(){
 if(dirty&&loaded){
  dirty=false;const rect=canvas.getBoundingClientRect();W=Math.max(250,Math.round(rect.width));H=Math.max(180,Math.round(rect.height));
  const dpr=Math.min(devicePixelRatio||1,2);canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
  background();axes();equipotentials();streamlines();vectors();sources();probeReadout();
 }
 requestAnimationFrame(render);
}
function setProbe(x,y){probe.x=x;probe.y=y;$('probe-x').value=Number(x.toFixed(3));$('probe-y').value=Number(y.toFixed(3));dirty=true;}
function move(e){
 const box=canvas.getBoundingClientRect(),p=xy((e.clientX-box.left)*W/box.width,(e.clientY-box.top)*H/box.height);
 if(dragging!==null){s.charges[dragging].x=p.x;s.charges[dragging].y=p.y;dirty=true;}else setProbe(p.x,p.y);
}
canvas.onpointerdown=e=>{
 dragging=null;
 if(s.mode==='charges'){const box=canvas.getBoundingClientRect();let best=24;s.charges.forEach((c,i)=>{const p=pixel(c.x,c.y),d=Math.hypot(p.x-(e.clientX-box.left),p.y-(e.clientY-box.top));if(d<best){dragging=i;best=d;}});}
 canvas.focus();canvas.setPointerCapture(e.pointerId);move(e);
};
canvas.onpointermove=e=>{if(canvas.hasPointerCapture(e.pointerId))move(e);};
canvas.onpointerup=canvas.onpointercancel=e=>{if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);dragging=null;};
canvas.onkeydown=e=>{
 if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();
 const h=s.extent/100*(e.shiftKey?5:1);
 setProbe(probe.x+(e.key==='ArrowRight'?h:e.key==='ArrowLeft'?-h:0),probe.y+(e.key==='ArrowUp'?h:e.key==='ArrowDown'?-h:0));
};
$('mode').onchange=()=>{controls();math();dirty=true;};
$('preset').onchange=preset;
$('coord-system').onchange=()=>{dirty=true;};
for(const id of ['vectors','heat','lines','equip','density'])$(id).oninput=()=>{dirty=true;};
$('extent').oninput=()=>{s.extent=+$('extent').value;dirty=true;};
for(const [id,key] of [['strength','strength'],['radius','radius'],['separation','separation']])$(id).oninput=()=>{s[key]=+$(id).value;controls();dirty=true;};
$('material').onchange=()=>{s.material=$('material').value;math();dirty=true;};
$('rref').onchange=()=>{const v=$('rref').valueAsNumber;if(v>=.01&&v<=100){s.rref=v;dirty=true;}else $('rref').value=s.rref;};
$('probe-form').onsubmit=e=>{
 e.preventDefault();const x=$('probe-x').valueAsNumber,y=$('probe-y').valueAsNumber;
 if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1e6||Math.abs(y)>1e6){$('notice').textContent=tr('invalid');return;}
 probe.x=x;probe.y=y;dirty=true;
};
for(const [id,q] of [['add-positive',1],['add-negative',-1]])$(id).onclick=()=>{if(s.charges.length>=MAX_CHARGES)return;s.charges.push({x:(s.charges.length%4-1.5)*.55,y:.9,q});chargeList();dirty=true;};
$('reset').onclick=()=>{
 const mode=$('mode').value;Object.assign(s,{...createDefaults(),mode,extent:+$('extent').value});
 for(const id of ['strength','radius','separation','rref','material'])$(id).value=s[id];
 setProbe(0,.6);preset();controls();math();
};
$('export').onclick=()=>canvas.toBlob(blob=>{
 if(!blob){$('message').textContent=tr('exportError');return;}
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='eevl-electrostatic-'+s.mode+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
},'image/png');
document.addEventListener('languagechange',()=>{if(loaded)translate();});
new ResizeObserver(()=>{dirty=true;}).observe(canvas);
try{
 const response=await fetch(new URL('./locales.json',import.meta.url));if(!response.ok)throw Error();
 dictionaries=await response.json();await initialize();loaded=true;
 validate(s);preset();translate();render();
}catch(error){
 console.error(error);$('notice').textContent=tr('error_load')==='error_load'?'Unable to load / Falha ao carregar / Error al cargar. Use HTTP/HTTPS.':tr('error_load');
}
