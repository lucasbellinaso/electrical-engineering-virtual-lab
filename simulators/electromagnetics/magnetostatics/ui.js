import {initialize} from '../../../assets/js/common.js';
import {language} from '../../../assets/js/i18n.js';
import katex from '../../../assets/vendor/katex/katex.mjs';
import {defaults,validate,createEvaluator,sources,coordinates} from './model.js';
import {parseState,serializeState,defaultView} from './state.js';
import {equations} from './equations.js';

const $=s=>document.querySelector(s),form=$('#settings'),canvas=$('#map'),ctx=canvas.getContext('2d');
let dictionaries={},p={...defaults},view={...defaultView},probe={x:.3,y:.2},result=null,evaluate=null,worker=null,job=0,busy=false,dirty=false,texture=null,lastError='',loaded=false;
const fmt=(v,n=5)=>new Intl.NumberFormat(language,{maximumSignificantDigits:n}).format(v);
const tr=(key,values={})=>Object.entries(values).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',String(v)),dictionaries[language]?.[key]??dictionaries.en?.[key]??key);
const pad=65,width=1000-2*pad;
const X=x=>pad+(x/p.extent+.5)*width,Y=y=>pad+(.5-y/p.extent)*width;
function read(){return Object.fromEntries(Object.keys(defaults).map(key=>[key,['mode','arrangement'].includes(key)?form.elements.namedItem(key).value:form.elements.namedItem(key).value.trim()===''?NaN:Number(form.elements.namedItem(key).value)]));}
function fill(parameters){Object.entries(parameters).forEach(([key,value])=>{form.elements.namedItem(key).value=value;});}
function setError(code){lastError=code;$('#error').hidden=!code;$('#error').textContent=code?tr('error_'+code):'';}
function exportsEnabled(){for(const id of ['csv','png','share'])$('#'+id).disabled=!result||busy||dirty;}
function status(){
 $('#status').textContent=busy?tr('busy'):dirty?tr('dirty'):result?tr('ready',{count:fmt(result.grid.length,7),maximum:fmt(result.maximum*1e6),excluded:fmt(result.excluded)}):'';
 exportsEnabled();
}
function visibility(){
 const mode=form.elements.mode.value;
 for(const [id,show]of [['arrangement-field',mode==='wires'],['radius-field',mode!=='wires'],['separation-field',mode==='wires'&&form.elements.arrangement.value!=='single'],['length-field',mode==='solenoid'],['turns-field',mode==='solenoid'],['segments-field',mode!=='wires']]){
  $('#'+id).hidden=!show;$('#'+id).querySelector('input,select').disabled=!show;
 }
 $('#wire-radius-label').textContent=tr(mode==='wires'?'wireRadius':'exclusionRadius');
 $('#probe-axis').textContent=mode==='wires'?'y (m)':'z (m)';$('#plane').textContent=tr(mode==='wires'?'planeXY':'planeXZ');
 $('#coordinate-note').textContent=tr(mode==='wires'?'coordinateXY':'coordinateXZ');
 $('#equations').replaceChildren();const list=equations(mode);
 list.forEach(([key,latex],j)=>{const section=document.createElement('div');section.className='equation-step';const text=document.createElement('p');text.textContent=(j+1)+'. '+tr(key);const math=document.createElement('div');math.className='math-block';katex.render(latex,math,{displayMode:true,throwOnError:true,trust:false,output:'htmlAndMathml'});section.append(text,math);$('#equations').append(section);});
 $('#latex-source').textContent=list.map(([key,latex])=>'% '+tr(key)+'\n'+latex).join('\n\n');
}
function translate(){
 document.querySelectorAll('[data-m]').forEach(el=>{el.textContent=tr(el.dataset.m);});
 document.querySelectorAll('[data-m-aria]').forEach(el=>el.setAttribute('aria-label',tr(el.dataset.mAria)));
 document.title=tr('title')+' · EEVL';visibility();if(lastError)setError(lastError);status();draw();updateProbe();
}
function palette(u){const stops=[[11,32,54],[18,104,151],[40,184,190],[247,213,123]],pos=Math.max(0,Math.min(1,u))*3,j=Math.min(2,Math.floor(pos)),f=pos-j;return stops[j].map((v,k)=>Math.round(v+(stops[j+1][k]-v)*f));}
function makeTexture(){
 if(!result)return;texture=document.createElement('canvas');texture.width=texture.height=result.size;const c=texture.getContext('2d'),image=c.createImageData(result.size,result.size);
 result.grid.forEach((f,j)=>{const ratio=result.maximum?f.magnitude/result.maximum:0,u=view.log?Math.log1p(999*ratio)/Math.log(1000):ratio,colour=f.excluded?[9,27,43]:palette(u);image.data.set([...colour,255],4*j);});c.putImageData(image,0,0);
}
function arrow(x,y,dx,dy,length=14){const magnitude=Math.hypot(dx,dy);if(magnitude<1e-22)return;dx/=magnitude;dy/=magnitude;const ex=x+dx*length/2,ey=y+dy*length/2;ctx.beginPath();ctx.moveTo(x-dx*length/2,y-dy*length/2);ctx.lineTo(ex,ey);ctx.moveTo(ex-5*dx-3*dy,ey-5*dy+3*dx);ctx.lineTo(ex,ey);ctx.lineTo(ex-5*dx+3*dy,ey-5*dy-3*dx);ctx.stroke();}
function drawSources(){
 const radius=p.wireRadius/p.extent*width;
 function mark(x,y,current){const a=X(x),b=Y(y);ctx.fillStyle='#122b40';ctx.strokeStyle=current<0?'#63b5ef':'#f18d9b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(a,b,Math.max(3,radius),0,2*Math.PI);ctx.fill();ctx.stroke();if(radius>6){ctx.fillStyle=ctx.strokeStyle;ctx.font='bold 15px Segoe UI';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(current===0?'0':current>0?'⊙':'⊗',a,b);}}
 ctx.save();ctx.beginPath();ctx.rect(pad,pad,width,width);ctx.clip();
 if(p.mode==='wires')for(const s of sources(p))mark(s.x,s.y,s.current);
 else for(const ring of sources(p)){mark(-p.radius,ring.z,p.current);mark(p.radius,ring.z,-p.current);}
 ctx.restore();
}
function draw(){
 ctx.fillStyle='#091b2b';ctx.fillRect(0,0,1000,1000);ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.font='19px Segoe UI';ctx.fillStyle='#dcebf4';ctx.fillText(tr(result?p.mode:form.elements.mode.value),pad,34);
 if(!result){ctx.font='20px Segoe UI';ctx.textAlign='center';ctx.fillText(busy?tr('busy'):'EEVL',500,500);return;}
 if(view.heat&&texture){ctx.imageSmoothingEnabled=true;ctx.drawImage(texture,pad,pad,width,width);}
 ctx.save();ctx.beginPath();ctx.rect(pad,pad,width,width);ctx.clip();
 ctx.strokeStyle='#a8c4d51c';ctx.lineWidth=1;for(let j=0;j<=8;j++){const n=pad+j*width/8;ctx.beginPath();ctx.moveTo(n,pad);ctx.lineTo(n,pad+width);ctx.moveTo(pad,n);ctx.lineTo(pad+width,n);ctx.stroke();}
 ctx.strokeStyle='#adc5d568';ctx.setLineDash([6,7]);ctx.beginPath();ctx.moveTo(X(0),pad);ctx.lineTo(X(0),pad+width);ctx.moveTo(pad,Y(0));ctx.lineTo(pad+width,Y(0));ctx.stroke();ctx.setLineDash([]);
 if(view.lines){ctx.strokeStyle='#f0cb81c9';ctx.lineWidth=1.6;for(const points of result.fieldLines){ctx.beginPath();points.forEach(([x,y],j)=>j?ctx.lineTo(X(x),Y(y)):ctx.moveTo(X(x),Y(y)));ctx.stroke();}}
 if(view.vectors){ctx.strokeStyle='#d4eef0c4';ctx.lineWidth=1.4;for(let row=2;row<result.size;row+=4)for(let col=2;col<result.size;col+=4){const f=result.grid[row*result.size+col];if(!f.excluded)arrow(X(f.x),Y(f.y),f.bx,-(p.mode==='wires'?f.by:f.bz),19);}}
 ctx.restore();drawSources();
 ctx.strokeStyle='#7095ad';ctx.lineWidth=1;ctx.strokeRect(pad,pad,width,width);ctx.font='15px Segoe UI';ctx.fillStyle='#b4cbd9';
 for(let j=0;j<=4;j++){const value=-p.extent/2+p.extent*j/4;ctx.textAlign='center';ctx.fillText(fmt(value,3),X(value),pad+width+27);ctx.textAlign='right';ctx.fillText(fmt(value,3),pad-12,Y(value)+5);}
 ctx.textAlign='center';ctx.fillText('x (m)',500,985);ctx.save();ctx.translate(18,500);ctx.rotate(-Math.PI/2);ctx.fillText(p.mode==='wires'?'y (m)':'z (m)',0,0);ctx.restore();
 ctx.textAlign='right';ctx.font='15px Segoe UI';ctx.fillText(`I = ${fmt(p.current)} A · μr = ${fmt(p.muR)}`,pad+width,34);
 if(Math.abs(probe.x)<=p.extent/2&&Math.abs(probe.y)<=p.extent/2){const x=X(probe.x),y=Y(probe.y);ctx.strokeStyle='#ffd786';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,9,0,2*Math.PI);ctx.moveTo(x-17,y);ctx.lineTo(x+17,y);ctx.moveTo(x,y-17);ctx.lineTo(x,y+17);ctx.stroke();}
 $('#scale-label').textContent=`0 — ${fmt(result.maximum*1e6)} µT · ${tr(view.log?'logScale':'linearScale')}`;
}
function updateProbe(){
 if(!evaluate||!result)return;
 const f=evaluate(probe.x,probe.y),pos=coordinates(probe.x,probe.y,p,f),cyl=view.coordinates==='cylindrical',axis=p.mode==='wires'?'By':'Bz';
 $('#b-value').textContent=f.excluded?'—':fmt(f.magnitude*1e6);$('#h-value').textContent=f.excluded?'—':fmt(f.hMagnitude);
 $('#components-label').textContent=cyl?(p.mode==='wires'?'Bρ / Bφ':'Bρ / Bz'):'Bx / '+axis;
 const radialUndefined=pos.rho===0;
 const component1=cyl?(radialUndefined?'—':fmt(pos.radial*1e6)):fmt(f.bx*1e6),component2=cyl?(p.mode==='wires'?(radialUndefined?'—':fmt(pos.azimuthal*1e6)):fmt(f.bz*1e6)):fmt((p.mode==='wires'?f.by:f.bz)*1e6);
 $('#components-value').textContent=f.excluded?'—':component1+' / '+component2;
 $('#angle-value').textContent=f.excluded||f.magnitude<1e-22?'—':fmt(Math.atan2(p.mode==='wires'?f.by:f.bz,f.bx)*180/Math.PI,4);
 $('#position').textContent=`(x, y, z) = (${fmt(pos.x)}, ${fmt(pos.y)}, ${fmt(pos.z)}) m`+(cyl?` · (ρ, φ, z) = (${fmt(pos.rho)} m, ${pos.rho===0?'—':fmt(pos.phi*180/Math.PI)+'°'}, ${fmt(pos.z)} m)`:'');
 const notes=[];
 if(f.excluded)notes.push(tr('excluded'));else if(f.magnitude<1e-22)notes.push(tr('zero'));
 if(p.mode==='wires'&&sources(p).some(s=>Math.hypot(probe.x-s.x,probe.y-s.y)<p.wireRadius))notes.push(tr('wireInterior'));
 if(Math.abs(probe.x)>p.extent/2||Math.abs(probe.y)>p.extent/2)notes.push(tr('probeOutside'));
 $('#probe-note').textContent=notes.join(' ');draw();
}
function calculate(){
 if(!form.reportValidity())return;let next;try{next=validate(read());}catch(e){setError(e.message);dirty=true;status();return;}
 worker?.terminate();const id=++job;p=next;result=null;texture=null;evaluate=createEvaluator(p);busy=true;dirty=false;setError('');for(const id of ['b-value','h-value','components-value','angle-value'])$('#'+id).textContent='—';$('#position').textContent='';$('#probe-note').textContent='';$('#scale-label').textContent='';$('#outside').hidden=true;status();draw();
 try{
  worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  worker.onmessage=event=>{if(event.data.id!==job)return;busy=false;if(event.data.error){setError(event.data.error);dirty=true;}else{result=event.data.result;makeTexture();draw();updateProbe();$('#outside').hidden=!(p.mode==='wires'?sources(p).some(s=>Math.abs(s.x)+p.wireRadius>p.extent/2):p.radius+p.wireRadius>p.extent/2||(p.mode==='solenoid'&&p.length/2+p.wireRadius>p.extent/2));}worker?.terminate();worker=null;status();};
  worker.onerror=()=>{if(id!==job)return;worker?.terminate();worker=null;busy=false;setError('worker');status();};
  worker.postMessage({id,parameters:p,options:{size:51,lines:view.lines}});
 }catch{busy=false;setError('worker');status();}
}
function fillView(){for(const key of ['heat','vectors','lines','log'])$('#'+key).checked=view[key];$('#coordinates').value=view.coordinates;$('#probe-x').value=probe.x;$('#probe-y').value=probe.y;}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
form.onsubmit=e=>{e.preventDefault();calculate();};form.oninput=()=>{dirty=true;status();};form.onchange=e=>{
 if(e.target.name==='mode'){const mode=e.target.value;fill({...defaults,mode,wireRadius:mode==='wires'?.04:.02});probe={x:mode==='wires'?.3:0,y:.2};fillView();}
 visibility();calculate();
};
$('#reset').onclick=()=>{fill({...defaults,mode:form.elements.mode.value,wireRadius:form.elements.mode.value==='wires'?.04:.02});view={...defaultView};probe={x:.3,y:.2};fillView();visibility();history.replaceState(null,'',location.pathname);$('#message').textContent='';$('#share-url').hidden=true;calculate();};
for(const key of ['heat','vectors','lines','log'])$('#'+key).onchange=()=>{view[key]=$('#'+key).checked;if(key==='lines')calculate();else{if(key==='log')makeTexture();draw();}};
$('#coordinates').onchange=()=>{view.coordinates=$('#coordinates').value;updateProbe();};
$('#probe-form').onsubmit=e=>{e.preventDefault();const x=$('#probe-x').valueAsNumber,y=$('#probe-y').valueAsNumber;if(![x,y].every(v=>Number.isFinite(v)&&Math.abs(v)<=10000)){setError('position');return;}probe={x,y};setError('');updateProbe();};
function pointFromEvent(e){if(!result)return;const box=canvas.getBoundingClientRect(),x=(e.clientX-box.left)/box.width*1000,y=(e.clientY-box.top)/box.height*1000;if(x<pad||x>pad+width||y<pad||y>pad+width)return;probe={x:(x-pad)/width*p.extent-p.extent/2,y:p.extent/2-(y-pad)/width*p.extent};$('#probe-x').value=probe.x.toFixed(5);$('#probe-y').value=probe.y.toFixed(5);updateProbe();}
canvas.onpointerdown=e=>{canvas.focus();canvas.setPointerCapture(e.pointerId);pointFromEvent(e);};canvas.onpointermove=e=>{if(e.buttons===1)pointFromEvent(e);};
canvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||!result)return;e.preventDefault();const step=p.extent/100*(e.shiftKey?5:1);probe.x=Math.max(-p.extent/2,Math.min(p.extent/2,probe.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0)));probe.y=Math.max(-p.extent/2,Math.min(p.extent/2,probe.y+(e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0)));$('#probe-x').value=probe.x.toFixed(5);$('#probe-y').value=probe.y.toFixed(5);updateProbe();};
$('#csv').onclick=()=>{if(!result)return;const rows=result.grid.map(f=>[f.x,p.mode==='wires'?f.y:0,p.mode==='wires'?0:f.y,...[f.bx,f.by,f.bz,f.magnitude,f.hMagnitude].map(v=>Number.isFinite(v)?v:''),Number(f.excluded)].join(','));download(new Blob(['\uFEFFx_m,y_m,z_m,Bx_T,By_T,Bz_T,Bmag_T,Hmag_A_per_m,excluded\r\n'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}),'eevl-magnetostatics-'+p.mode+'.csv');};
$('#png').onclick=()=>canvas.toBlob(blob=>{if(blob)download(blob,'eevl-magnetostatics-'+p.mode+'.png');else $('#message').textContent=tr('exportError');},'image/png');
$('#share').onclick=async()=>{if(!result)return;const url=new URL(location.href);url.search=serializeState(p,probe,view);history.replaceState(null,'',url);try{await navigator.clipboard.writeText(url.href);$('#message').textContent=tr('copied');}catch{$('#share-url').hidden=false;$('#share-url').value=url.href;$('#share-url').select();$('#message').textContent=tr('copyFallback');}};
document.addEventListener('languagechange',()=>{if(loaded)translate();});
try{const response=await fetch(new URL('./locales.json',import.meta.url));if(!response.ok)throw Error();dictionaries=await response.json();await initialize();loaded=true;let state,invalid=false;try{state=parseState(location.search);}catch{state=parseState();invalid=true;}p=state.parameters;probe=state.probe;view=state.view;fill(p);fillView();translate();calculate();if(invalid)$('#message').textContent=tr('queryError');}catch(error){console.error(error);$('#error').hidden=false;$('#error').textContent=tr('error_load')==='error_load'?'Unable to load / Falha ao carregar / Error al cargar. Use HTTP/HTTPS.':tr('error_load');}
