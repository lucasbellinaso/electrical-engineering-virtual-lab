import {initialize} from '../../assets/js/common.js';
import {t,language} from '../../assets/js/i18n.js';
import {simulate,defaults,validate} from './model.js';
const $=s=>document.querySelector(s), form=$('#parameters'); let result,plotScale;
const number = (value,digits=4) => new Intl.NumberFormat(language,{maximumSignificantDigits:digits}).format(value);
function read() { return Object.fromEntries(Object.keys(defaults).map(key=>[key,Number(form.elements[key].value)])); }
function fill(p) { Object.entries(p).forEach(([key,value])=> {form.elements[key].value=value;}); }
function showError(key) { $('#error').hidden=!key; $('#error').textContent=key?t(key):''; }
function run() {
  try { result=simulate(read()); showError(''); render(); } catch { showError('invalidParameters'); }
}
function render() {
  if (!result) return;
  const {samples,tau,maxError}=result, voltages=samples.flatMap(s=>[s.voltage,s.exact]);
  let min=Math.min(...voltages,0), max=Math.max(...voltages,0); if (max-min<1e-6) {min-=1;max+=1;}
  const pad=(max-min)*.12;min-=pad;max+=pad;
  const x=time=>65+time/samples.at(-1).time*665,y=v=>320-(v-min)/(max-min)*270;
  const path=key=>samples.map((s,i)=>`${i?'L':'M'}${x(s.time).toFixed(2)},${y(s[key]).toFixed(2)}`).join(' ');
  let markup='';
  for(let i=0;i<=5;i++) {
    const time=samples.at(-1).time*i/5, value=min+(max-min)*i/5;
    markup+=`<path d="M65 ${y(value)}H730" stroke="#b7cbd9" stroke-width=".5"/><text x="55" y="${y(value)+4}" text-anchor="end">${number(value,3)}</text><text x="${x(time)}" y="343" text-anchor="middle">${number(time*1000,3)}</text>`;
  }
  markup+=`<path d="M65 50V320H730" fill="none" stroke="currentColor"/><path d="${path('voltage')}" fill="none" stroke="#258bc5" stroke-width="3"/><path d="${path('exact')}" fill="none" stroke="#a87027" stroke-width="1.6" stroke-dasharray="5 5"/><text x="396" y="375" text-anchor="middle">${t('timeAxis')}</text><text transform="translate(17 190) rotate(-90)" text-anchor="middle">${t('voltageAxis')}</text><path d="M180 20H205" stroke="#258bc5" stroke-width="3"/><text x="212" y="24">${t('numerical')}</text><path d="M400 20H425" stroke="#a87027" stroke-width="1.6" stroke-dasharray="5 5"/><text x="432" y="24">${t('analytical')}</text>`;
  $('#plot-content').innerHTML=markup+'<g id="probe"></g>';plotScale={x,y};$('#inspect').max=samples.length-1;inspect(Number($('#inspect').value));$('#plot-title').textContent=t('response');$('#plot-desc').textContent=t('plotDescription');
  $('#final-voltage').textContent=number(samples.at(-1).voltage)+' V';$('#tau').textContent=number(tau*1000)+' ms';$('#max-error').textContent=maxError.toExponential(2)+' V';
  $('#message').textContent=t('ready',{count:samples.length});
  $('#samples').innerHTML=Array.from({length:11},(_,i)=>samples[Math.round(i*(samples.length-1)/10)]).map(s=>`<tr><td>${number(s.time*1000,6)}</td><td>${number(s.voltage,6)}</td></tr>`).join('');
  document.title=t('rcTitle')+' — EEVL';
}
function inspect(index){
  if(!result||!plotScale)return;
  const i=Math.max(0,Math.min(result.samples.length-1,Math.round(index))),sample=result.samples[i];
  $('#inspect').value=i;$('#sample-value').textContent=t('sampleValue',{time:number(sample.time*1000,6),voltage:number(sample.voltage,6)});
  $('#probe').innerHTML=`<path d="M${plotScale.x(sample.time)} 50V320" stroke="#6c92ad" stroke-dasharray="3 4"/><circle cx="${plotScale.x(sample.time)}" cy="${plotScale.y(sample.voltage)}" r="4" fill="#258bc5" stroke="white" stroke-width="1.5"/>`;
}
$('#inspect').addEventListener('input',e=>inspect(Number(e.target.value)));
$('#plot').addEventListener('pointermove',e=>{if(!result)return;const bounds=$('#plot').getBoundingClientRect(),x=(e.clientX-bounds.left)/bounds.width*760;inspect((x-65)/665*(result.samples.length-1));});
function download(blob,name) { const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function svgBlob() { const clone=$('#plot').cloneNode(true);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width','1520');clone.setAttribute('height','780');clone.style.cssText='background:white;color:#172f43;font-family:Segoe UI,Arial,sans-serif';const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='text{font:11px Segoe UI,Arial,sans-serif;fill:#172f43}';clone.prepend(style);return new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'}); }
form.addEventListener('submit',e=>{e.preventDefault();run();});
$('#reset').addEventListener('click',()=>{fill(defaults);$('#share-url').hidden=true;history.replaceState(null,'',location.pathname);run();});
$('#csv').addEventListener('click',()=>{if(result) download(new Blob(['\uFEFF'+`# R_ohm=${result.parameters.resistance},C_uF=${result.parameters.capacitance},Vs_V=${result.parameters.voltage},v0_V=${result.parameters.initialVoltage},h_s=${result.step}\n`+`time_s,voltage_V,analytical_V\n`+result.samples.map(s=>`${s.time},${s.voltage},${s.exact}`).join('\n')],{type:'text/csv;charset=utf-8'}),'eevl-rc.csv');});
$('#svg').addEventListener('click',()=>download(svgBlob(),'eevl-rc.svg'));
$('#png').addEventListener('click',async()=>{
  const url=URL.createObjectURL(svgBlob());
  try {const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=1520;canvas.height=780;canvas.getContext('2d').drawImage(image,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error();download(blob,'eevl-rc.png');}catch{$('#message').textContent=t('exportError');}finally{URL.revokeObjectURL(url);}
});
$('#share').addEventListener('click',async()=>{
  try {const p=validate(read()),url=new URL(location.href);url.search=new URLSearchParams(p).toString();history.replaceState(null,'',url);try{await navigator.clipboard.writeText(url.href);$('#message').textContent=t('copied');}catch{$('#share-url').hidden=false;$('#share-url').value=url.href;$('#share-url').select();$('#message').textContent=t('copyFallback');}}catch{showError('invalidParameters');}
});
document.addEventListener('languagechange',()=>{render();if(!$('#error').hidden)showError('invalidParameters');});
try {
  await initialize();let p={...defaults};const query=new URLSearchParams(location.search);for(const key of Object.keys(defaults))if(query.has(key))p[key]=Number(query.get(key));
  try{validate(p);}catch{p={...defaults};showError('queryError');}
  fill(p);result=simulate(p);render();
}catch(error){console.error(error);showError('loadError');}
