import {initialize} from '../../../assets/js/common.js';
import {t,language} from '../../../assets/js/i18n.js';
import katex from '../../../assets/vendor/katex/katex.mjs';
import {presets,validate,characteristics,recommendedDuration} from './model.js';
import {equations} from './equations.js';
import {diagram} from './diagram.js';
import {chart,probe,traces,traceLabel,color,imageBlob,referenceRange,dataRange} from './chart.js';
import {numberLatex,proseParts,traceLatex} from './presentation.js';

const tc=key=>t(`circuit_${key}`);
const $=s=>document.querySelector(s),form=$('#parameters'),family=document.body.dataset.family;
const allowed=family==='first'?['rc','rl']:['series','parallel'];
let topology=allowed[0],result=null,worker=null,sequence=0,busy=false,dirty=false,initialized=false;
let visible={voltage:new Set(),current:new Set()},geometry={},sampleIndex=0,lastError='',scales={};
const fmt=(n,digits=5)=>new Intl.NumberFormat(language,{maximumSignificantDigits:digits}).format(n);
const num=(n,digits=5)=>numberLatex(n,language,digits);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function read(){return {...Object.fromEntries(Object.keys(presets.rc).filter(k=>!['topology','excitation'].includes(k)).map(k=>[k,form.elements[k].value.trim()===''?NaN:Number(form.elements[k].value)])),topology,excitation:form.elements.excitation.value};}
function fill(p){topology=p.topology;for(const [key,value]of Object.entries(p))if(form.elements[key])form.elements[key].value=value;}
function error(code){lastError=code;$('#error').hidden=!code;$('#error').textContent=code?tc('error_'+code):'';}
function enableExports(enabled){for(const id of ['csv','svg','png','share'])$('#'+id).disabled=!enabled;}
function renderMath(node,latex,displayMode=false){katex.render(latex,node,{displayMode,throwOnError:true,trust:false,output:'htmlAndMathml'});}
function mathText(container,latex){container.replaceChildren();renderMath(container,latex);}
function prose(node,value){node.replaceChildren(...proseParts(value).map(part=>{if('text' in part)return document.createTextNode(part.text);const span=document.createElement('span');renderMath(span,part.latex);return span;}));}
function mixedLabel(node,phrase,latex){node.replaceChildren();const text=document.createElement('span'),math=document.createElement('span');text.textContent=phrase;node.append(text,document.createTextNode(' '),math);renderMath(math,latex);}
function status(){
 $('#state').textContent=busy?t('circuit_computing'):dirty?t('circuit_dirty'):result?t('circuit_completed',{count:fmt(result.samples.length,8),step:fmt(result.step*1e6)}):t('circuit_noResult');
 enableExports(Boolean(result)&&!busy&&!dirty);
}
function controls(){
 document.querySelectorAll('[data-topology]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.topology===topology)));
 $('#inductance-field').hidden=topology==='rc';form.elements.inductance.disabled=topology==='rc';
 $('#capacitance-field').hidden=topology==='rl';form.elements.capacitance.disabled=topology==='rl';
 $('#v0-field').hidden=topology==='rl';form.elements.v0.disabled=topology==='rl';
 $('#i0-field').hidden=topology==='rc';form.elements.i0.disabled=topology==='rc';
 $('#source-field').hidden=form.elements.excitation.value==='natural';form.elements.source.disabled=form.elements.excitation.value==='natural';
 mixedLabel(form.elements.resistance.closest('label').querySelector('span'),t('circuit_resistance'),String.raw`R\;(\Omega)`);
 mixedLabel(form.elements.inductance.closest('label').querySelector('span'),t('circuit_inductance'),String.raw`L\;(\mathrm{mH})`);
 mixedLabel(form.elements.capacitance.closest('label').querySelector('span'),t('circuit_capacitance'),String.raw`C\;(\mu\mathrm{F})`);
 mixedLabel(form.elements.v0.closest('label').querySelector('span'),t('circuit_initialVoltage'),String.raw`V_0\;(\mathrm{V})`);
 mixedLabel(form.elements.i0.closest('label').querySelector('span'),t('circuit_initialCurrent'),String.raw`I_0\;(\mathrm{mA})`);
 mixedLabel(form.elements.duration.closest('label').querySelector('span'),t('circuit_duration'),String.raw`T\;(\mathrm{ms})`);
 mixedLabel($('#source-label'),t(topology==='parallel'?'circuit_sourceMA':'circuit_voltageSource'),topology==='parallel'?String.raw`I_s\;(\mathrm{mA})`:String.raw`V_s\;(\mathrm{V})`);
 renderMath($('#source-hint'),String.raw`-1000\ldots1000\;${topology==='parallel'?String.raw`\mathrm{mA}`:String.raw`\mathrm{V}`}`);
 form.elements.resistance.min=topology==='series'?'0':'0.001';renderMath($('#resistance-hint'),`${topology==='series'?'0':'0.001'}\\ldots10^9\\,\\Omega`);
 renderMath($('#inductance-field').querySelector('small'),String.raw`0.001\ldots10^6\,\mathrm{mH}`);renderMath($('#capacitance-field').querySelector('small'),String.raw`0.001\ldots10^6\,\mu\mathrm{F}`);
 renderMath($('#v0-field').querySelector('small'),String.raw`-1000\ldots1000\,\mathrm{V}`);renderMath($('#i0-field').querySelector('small'),String.raw`-10^6\ldots10^6\,\mathrm{mA}`);renderMath(form.elements.duration.closest('label').querySelector('small'),String.raw`10^{-6}\ldots10^7\,\mathrm{ms}`);
 $('#schematic').innerHTML=diagram(topology);
 $('#schematic').querySelectorAll('[data-latex]').forEach(node=>renderMath(node,node.dataset.latex));
 const schematic=$('#schematic svg'),svgNS='http://www.w3.org/2000/svg';
 const schematicTitle=document.createElementNS(svgNS,'title'),schematicDescription=document.createElementNS(svgNS,'desc');
 schematicTitle.id='circuit-schematic-title';schematicTitle.textContent=tc(topology+'Title');
 schematicDescription.id='circuit-schematic-description';schematicDescription.textContent=t('circuit_signConvention');
 schematic.prepend(schematicTitle,schematicDescription);schematic.removeAttribute('aria-label');schematic.setAttribute('aria-labelledby',schematicTitle.id+' '+schematicDescription.id);
 installScaleControls();
 prose($('#initial-equation-note'),t(topology==='parallel'?'circuit_parallelNote':'circuit_voltageNote'));
 $('#presets').innerHTML=(family==='first'?['stepPreset','naturalPreset']:['underdamped','critical','overdamped','naturalPreset']).map(key=>`<button type="button" data-preset="${key}">${esc(tc(key))}</button>`).join('');
 $('#presets').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.preset)));
 document.title=t(family==='first'?'circuit_firstTitle':'circuit_secondTitle')+' — EEVL';
 const list=equations(topology);$('#equation-steps').replaceChildren();
 for(const [j,[key,latex]]of list.entries()){
  const row=document.createElement('div');row.className='equation-step';
  const n=document.createElement('span');n.className='step-number';n.textContent=j+1;
  const content=document.createElement('div'),text=document.createElement('p'),math=document.createElement('div');
  prose(text,t(key));math.className='equation-math';
  renderMath(math,latex,true);
  content.append(text,math);row.append(n,content);$('#equation-steps').append(row);
 }
 $('#latex-source').textContent=list.map(([key,latex])=>'% '+t(key)+'\n'+latex).join('\n\n');
 document.querySelectorAll('[data-i18n]').forEach(node=>{const phrase=t(node.dataset.i18n);if(node.tagName!=='OPTION'&&phrase.includes('\\('))prose(node,phrase);});
 if(lastError)error(lastError);status();
}
function resetVisibility(){visible={voltage:new Set(traces(topology,'voltage')),current:new Set(traces(topology,'current'))};}
function installScaleControls(){for(const q of ['voltage','current']){if(!$(`#${q}-adjust`)){const box=$(`#${q}-plot`).closest('.chart-box'),controls=document.createElement('div');controls.className='plot-controls scale-controls';controls.innerHTML=`<span class="range-notice" id="${q}-range-notice" role="status" aria-live="polite" hidden></span><button type="button" id="${q}-adjust"></button><button type="button" id="${q}-restore"></button>`;box.append(controls);$('#'+q+'-adjust').addEventListener('click',()=>{if(!result)return;scales[`${topology}:${q}`]=dataRange(result,q,visible[q]);draw();});$('#'+q+'-restore').addEventListener('click',()=>{delete scales[`${topology}:${q}`];draw();});}$('#'+q+'-adjust').textContent=t('circuit_adjustScale');$('#'+q+'-restore').textContent=t('circuit_restoreScale');}}
function legends(){
 for(const q of ['voltage','current']){
  $('#'+q+'-legend').innerHTML=traces(topology,q).map(key=>`<label><input type="checkbox" data-trace="${key}" ${visible[q].has(key)?'checked':''}><i style="background:${color(key)}" aria-hidden="true"></i><span class="trace-name">${esc(t(key==='source'?(topology==='parallel'?'circuit_currentSource':'circuit_voltageSource'):`circuit_${key}`))}</span><span class="trace-math"></span></label>`).join('');
  $('#'+q+'-legend').querySelectorAll('label').forEach(label=>{const key=label.querySelector('input').dataset.trace;mathText(label.querySelector('.trace-math'),traceLatex(topology,key));});
  $('#'+q+'-legend').querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{input.checked?visible[q].add(input.dataset.trace):visible[q].delete(input.dataset.trace);draw();}));
 }
}
function metric(label,latex,detail=''){return `<div><span>${esc(t(label))}</span><strong class="metric-math" data-latex="${esc(latex)}"></strong>${detail?`<small class="metric-detail" data-latex="${esc(detail)}"></small>`:''}</div>`;}
function render(){
 if(!result)return;
 const final=result.samples.at(-1),c=result.characteristics,first=family==='first';
 const voltage=topology==='rl'?final.vL:final.vc,current=topology==='rc'?final.iC:final.il;
 const damping=first?metric('timeConstant',`${num(c.tau*1000)}\\,\\mathrm{ms}`,String.raw`\tau`):`<div><span>${esc(t('circuit_damping'))}</span><strong>${esc(tc(c.regime))}</strong><small data-latex="${esc(String.raw`\zeta=${num(c.zeta)},\quad f_0=${num(c.omega0/(2*Math.PI))}\,\mathrm{Hz}`)}"></small></div>`;
 $('#metrics').innerHTML=metric(topology==='rl'?'circuit_finalVL':'circuit_finalVC',`${num(voltage)}\\,\\mathrm{V}`)+metric(topology==='rc'?'circuit_finalIC':'circuit_finalIL',`${num(current*1000)}\\,\\mathrm{mA}`)+metric('circuit_storedEnergy',`${num(final.energy*1e6)}\\,\\mu\\mathrm{J}`)+damping+metric('circuit_errorV',`${num(result.errorV)}\\,\\mathrm{V}`)+metric('circuit_errorI',`${num(result.errorI)}\\,\\mathrm{A}`);
 $('#metrics').querySelectorAll('[data-latex]').forEach(node=>renderMath(node,node.dataset.latex));
 $('#inspect').max=result.samples.length-1;$('#inspect').value=Math.min(sampleIndex,result.samples.length-1);
 mathText($('#table-voltage'),topology==='rl'?String.raw`v_L\;(\mathrm{V})`:String.raw`v_C\;(\mathrm{V})`);mathText($('#table-current'),topology==='rc'?String.raw`i_C\;(\mathrm{mA})`:String.raw`i_L\;(\mathrm{mA})`);
 $('#samples').innerHTML=Array.from({length:11},(_,j)=>result.samples[Math.round(j*(result.samples.length-1)/10)]).map(s=>`<tr><td>${fmt(s.time*1000,7)}</td><td>${fmt(topology==='rl'?s.vL:s.vc,7)}</td><td>${fmt((topology==='rc'?s.iC:s.il)*1000,7)}</td><td>${fmt(s.energy*1e6,7)}</td></tr>`).join('');
 legends();draw();status();
}
function draw(){if(!result)return;for(const q of ['voltage','current']){const svg=$('#'+q+'-plot'),range=scales[`${topology}:${q}`]||referenceRange(topology,q);geometry[q]=chart(svg,result,q,visible[q],$('#analytical').checked,t,fmt,range);const notice=$(`#${q}-range-notice`);notice.hidden=!geometry[q].outside;notice.textContent=geometry[q].outside?t('circuit_outOfRange'):'';$('#'+q+'-adjust').disabled=false;$('#'+q+'-restore').disabled=range[0]===referenceRange(topology,q)[0]&&range[1]===referenceRange(topology,q)[1];}inspect(sampleIndex);}
function inspect(index){
 if(!result)return;sampleIndex=Math.max(0,Math.min(result.samples.length-1,Math.round(index)));const s=result.samples[sampleIndex];$('#inspect').value=sampleIndex;
 const v=topology==='rl'?s.vL:s.vc,i=topology==='rc'?s.iC:s.il;
 mathText($('#sample-value'),`t=${num(s.time*1000)}\\,\\mathrm{ms},\\quad ${topology==='rl'?String.raw`v_L`:String.raw`v_C`}=${num(v)}\\,\\mathrm{V},\\quad ${topology==='rc'?String.raw`i_C`:String.raw`i_L`}=${num(i*1000)}\\,\\mathrm{mA},\\quad E=${num(s.energy*1e6)}\\,\\mu\\mathrm{J}`);
 for(const q of ['voltage','current'])if(geometry[q])probe($('#'+q+'-plot'),geometry[q],s);
}
function run(){
 if(!form.reportValidity())return;
 let p;try{p=validate(read());}catch(e){error(e.code||'parameters');dirty=true;status();return;}
 worker?.terminate();const id=++sequence;busy=true;dirty=false;error('');status();$('#message').textContent='';
 try{
  worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  worker.addEventListener('message',event=>{if(event.data.id!==sequence)return;busy=false;if(event.data.error){dirty=true;error(event.data.error);status();}else{result=event.data.result;render();}worker?.terminate();worker=null;});
  worker.addEventListener('error',()=>{if(id!==sequence)return;busy=false;dirty=true;error('worker');status();worker?.terminate();worker=null;});
  worker.postMessage({id,parameters:p});
 }catch{busy=false;dirty=true;error('worker');status();}
}
function select(next,preserveScale=false){
 worker?.terminate();++sequence;busy=false;dirty=false;result=null;sampleIndex=0;if(!preserveScale)scales={};fill({...presets[next]});resetVisibility();
 $('#metrics').replaceChildren();for(const q of ['voltage','current'])$('#'+q+'-plot').replaceChildren();geometry={};$('#sample-value').textContent='';$('#samples').replaceChildren();$('#share-url').hidden=true;controls();run();
}
function applyPreset(key){
 try{
  const p=validate(read());
  if(key==='naturalPreset'){p.excitation='natural';p.v0=topology==='rl'?0:5;p.i0=topology==='rl'?50:0;}
  else if(key==='stepPreset'){p.excitation='step';p.v0=0;p.i0=0;}
  else{const {L,C}=characteristics(p),critical=topology==='series'?2*Math.sqrt(L/C):.5*Math.sqrt(L/C),zeta={underdamped:.25,critical:1,overdamped:2}[key];p.resistance=topology==='series'?critical*zeta:critical/zeta;}
  p.duration=recommendedDuration(p);fill(p);controls();run();
 }catch(e){error(e.code||'parameters');}
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function exportName(extension){return 'eevl-'+topology+'.'+extension;}
function svgBlob(){return imageBlob([$('#voltage-plot'),$('#current-plot')],tc(topology+'Title')+' · EEVL');}
form.addEventListener('submit',e=>{e.preventDefault();run();});
form.addEventListener('input',()=>{dirty=true;status();});
form.elements.excitation.addEventListener('change',controls);
document.querySelectorAll('[data-topology]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.topology)));
$('#reset').addEventListener('click',()=>{history.replaceState(null,'',location.pathname);select(topology,true);});
$('#auto-duration').addEventListener('click',()=>{try{form.elements.duration.value=recommendedDuration(validate(read()));run();}catch(e){error(e.code||'parameters');}});
$('#analytical').addEventListener('change',draw);$('#inspect').addEventListener('input',e=>inspect(Number(e.target.value)));
for(const q of ['voltage','current'])$('#'+q+'-plot').addEventListener('pointermove',e=>{if(!result)return;const bounds=e.currentTarget.getBoundingClientRect(),x=(e.clientX-bounds.left)/bounds.width*840;inspect((x-64)/746*(result.samples.length-1));});
$('#csv').addEventListener('click',()=>{
 if(!result)return;const keys=['time','vc','il','vR','vL','iR','iC','source','energy','exactVC','exactIL'];
 const header='time_s,vC_V,iL_A,vR_V,vL_V,iR_A,iC_A,source_'+(topology==='parallel'?'A':'V')+',energy_J,analytical_vC_V,analytical_iL_A';
 download(new Blob(['\uFEFF'+header+'\r\n'+result.samples.map(s=>keys.map(k=>s[k]).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),exportName('csv'));
});
$('#svg').addEventListener('click',()=>download(svgBlob(),exportName('svg')));
$('#png').addEventListener('click',async()=>{const url=URL.createObjectURL(svgBlob());try{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=1680;canvas.height=1320;canvas.getContext('2d').drawImage(img,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error();download(blob,exportName('png'));}catch{$('#message').textContent=t('exportError');}finally{URL.revokeObjectURL(url);}});
$('#share').addEventListener('click',async()=>{if(!result)return;const url=new URL(location.href);url.search=new URLSearchParams(result.parameters).toString();history.replaceState(null,'',url);try{await navigator.clipboard.writeText(url.href);$('#message').textContent=t('copied');}catch{$('#share-url').hidden=false;$('#share-url').value=url.href;$('#share-url').select();$('#message').textContent=t('copyFallback');}});
document.addEventListener('languagechange',()=>{if(initialized){controls();render();}});
try{
 await initialize();initialized=true;
 const query=new URLSearchParams(location.search),candidate=query.get('topology')||topology;let invalid=!allowed.includes(candidate),p={...presets[invalid?topology:candidate]};
 if(!invalid){for(const key of Object.keys(p))if(query.has(key))p[key]=['topology','excitation'].includes(key)?query.get(key):query.get(key).trim()===''?NaN:Number(query.get(key));try{validate(p);}catch{invalid=true;}}
 if(invalid)p={...presets[topology]};fill(p);resetVisibility();controls();run();if(invalid)$('#message').textContent=t('queryError');
}catch(e){console.error(e);error('load');}
