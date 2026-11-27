import {initialize} from '../../../assets/js/common.js';
import {language} from '../../../assets/js/i18n.js';
import katex from '../../../assets/vendor/katex/katex.mjs';
import {defaults,validate,fitModule,simulate,simulateIEC,compareCatalog,referenceConditions,iecParameters,iecConstants} from './model.js';
import {modulePresets,presetFields} from './presets.js';
const $=id=>document.getElementById(id), form=$('parameters'), svgNS='http://www.w3.org/2000/svg';
const plotArea={left:55,top:12,width:565,height:265};
let dictionary={}, fit=null, signature='', result=null, bounds=null, inspectIndex=null, currentParameters=null, valid=false;
const tr=key=>dictionary[language]?.[key]??dictionary.en?.[key]??key;
const fmt=value=>new Intl.NumberFormat(language,{maximumFractionDigits:2}).format(value);
const math=(node,source,display=false)=>katex.render(source,node,{throwOnError:false,displayMode:display,trust:false});
const text=(tag,content,attrs={})=>{const e=document.createElementNS(svgNS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));if(content!==null)e.textContent=content;return e;};
function read(){const p={};for(const key of Object.keys(defaults)){const input=$(key);if(input.value.trim()===''||!input.checkValidity())throw new RangeError('invalid');p[key]=Number(input.value);}return validate(p);}
function signatureOf(p){return [p.voc,p.isc,p.vmp,p.imp,p.alpha,p.beta,p.cells].join('|');}
function calculate(p,model){if(model==='iec')return simulateIEC(p);const key=signatureOf(p);if(!fit||key!==signature){fit=fitModule(p);signature=key;}return simulate(p,fit);}
function adjustBounds(p,model){const cases=[[1400,-40],[1400,0],[1400,25],[1400,50],[1400,75],[1400,100],[1000,25]],samples=[result];for(const [irradiance,temperature] of cases){try{samples.push(calculate({...p,irradiance,temperature},model));}catch(error){if(!(error instanceof RangeError))throw error;}}return {v:Math.max(...samples.map(v=>v.voc))*1.1||1,i:Math.max(...samples.map(v=>v.isc))*1.1||1,p:Math.max(...samples.map(v=>v.pmp))*1.15||1};}
function metrics(r){
 const container=$('metrics'), comparison=compareCatalog(currentParameters,r);container.replaceChildren();
 for(const [key,latex,unit] of [['voc','V_{oc}','V'],['isc','I_{sc}','A'],['vmp','V_{mp}','V'],['imp','I_{mp}','A'],['pmp','P_{mp}','W']]){
  const card=document.createElement('div');card.className='metric';const label=document.createElement('span');math(label,latex);
  const strong=document.createElement('strong');strong.textContent=fmt(r[key])+' ';const unitNode=document.createElement('span');math(unitNode,String.raw`\mathrm{${unit}}`);strong.append(unitNode);
  const delta=document.createElement('small');delta.className='metric-delta';const difference=Math.abs(comparison[key].difference)<0.005?0:comparison[key].difference, percent=Math.abs(comparison[key].percent)<0.005?0:comparison[key].percent;
  delta.append(document.createTextNode((difference>0?'+':'')+fmt(difference)+' '));const deltaUnit=document.createElement('span');math(deltaUnit,String.raw`\mathrm{${unit}}`);delta.append(deltaUnit,document.createTextNode(' ('+(percent>0?'+':'')+fmt(percent)+'%)'));
  card.append(label,strong,delta);container.append(card);
 }
}
function chart(element,points,field,xmax,ymax,mpp){
 element.replaceChildren();const {left,top,width:w,height:h}=plotArea;
 for(let i=0;i<=4;i++){const y=top+h-i*h/4,x=left+i*w/4;element.append(text('line',null,{x1:left,y1:y,x2:left+w,y2:y,stroke:'#b8cfda','stroke-width':1}),text('line',null,{x1:x,y1:top,x2:x,y2:top+h,stroke:'#b8cfda','stroke-width':1}),text('text',fmt(ymax*i/4),{x:left-8,y:y+4,'text-anchor':'end',fill:'#516a7d','font-size':12}),text('text',fmt(xmax*i/4),{x,y:top+h+20,'text-anchor':'middle',fill:'#516a7d','font-size':12}));}
 const xy=(v,y)=>[left+w*v/xmax,top+h-h*y/ymax];
 const list=points.map(pt=>{const [x,y]=xy(pt.v,pt[field]);return x+','+y;}).join(' ');
 element.append(text('polyline',null,{points:list,fill:'none',stroke:'#1765a2','stroke-width':3,'stroke-linejoin':'round'}));
 const [mx,my]=xy(mpp.v,mpp[field]);element.append(text('circle',null,{cx:mx,cy:my,r:5,fill:'#d97706',stroke:'#fff','stroke-width':1.5}));
}
const common=String.raw`V_{arr}=N_sV_{mod},\qquad I_{arr}=N_pI_{mod},\qquad P_{arr}=N_sN_pP_{mod}`;
const desoto=[String.raw`I=I_L-I_0\left[\exp\!\left(\frac{V+IR_s}{a}\right)-1\right]-\frac{V+IR_s}{R_{sh}}`,String.raw`I_L=\frac{G}{G_{STC}}\left(I_{L,ref}+\alpha_{sc}(T-T_{ref})\right),\qquad R_{sh}=R_{sh,ref}\frac{G_{STC}}{G}`,String.raw`a=a_{ref}\frac{T_K}{T_{ref,K}},\qquad I_0=I_{0,ref}\left(\frac{T_K}{T_{ref,K}}\right)^3\exp\!\left(\frac{E_{g,ref}}{kT_{ref,K}}-\frac{E_g(T)}{kT_K}\right)`,String.raw`E_g(T)=E_{g,ref}\left[1+\delta_E(T-T_{ref})\right],\quad R_s=R_{s,ref}`];
const iec=[String.raw`F_{Fv}=\frac{V_{mp,STC}}{V_{oc,STC}},\qquad F_{Fi}=\frac{I_{mp,STC}}{I_{sc,STC}}`,String.raw`I_{sc}=I_{sc,STC}\frac{G}{G_{STC}}\left[1+\alpha_{sc}(T-T_{STC})\right]`,String.raw`V_c=V_{oc,STC}\left[1+\beta_{oc}(T-T_{STC})\right]\left[C_v\ln\!\left(\frac{G}{C_g}+1\right)-C_rG\right]`,String.raw`I_0=I_{sc,STC}(1-F_{Fi})^{1/(1-F_{Fv})}\frac{G}{G_{STC}},\qquad C_{aq}=\frac{F_{Fv}-1}{\ln(1-F_{Fi})}`,String.raw`I(V)=I_{sc}+I_0-I_0\exp\!\left(\frac{V}{V_cC_{aq}}\right),\quad V>0`,String.raw`V(I)=V_c C_{aq}\ln\!\left(\frac{I_{sc}+I_0-I}{I_0}\right),\quad 0\le I\le I_{sc}`,String.raw`I(V)=I_{sc}-V/R_d\quad(V\le 0),\qquad V(I)=-R_d(I-I_{sc})\quad(I>I_{sc})`,String.raw`C_g=2.514\times10^{-3},\quad C_v=8.593\times10^{-2},\quad C_r=1.088\times10^{-4}`];
function precise(value){
 const scientific=value!==0&&(Math.abs(value)<1e-3||Math.abs(value)>=1e5);
 const [mantissa,exponent]=scientific?value.toExponential(9).split('e'):[String(value),null];
 const number=new Intl.NumberFormat(language,{maximumSignificantDigits:10,useGrouping:false}).format(Number(mantissa)).replace(',','{,}');
 return exponent===null?number:number+String.raw`\times 10^{${Number(exponent)}}`;
}
function fitCards(container,items){
 container.replaceChildren();for(const [label,value,unit] of items){const card=document.createElement('div');card.className='fit-parameter';math(card,`${label} = ${precise(value)}\\;${unit}`);container.append(card);}
}
function renderFitParameters(model){
 const visible=valid&&model==='desoto'&&fit&&currentParameters&&signature===signatureOf(currentParameters);
 $('fitSection').hidden=!visible;if(!visible)return;
 fitCards($('fitParameters'),[
  [String.raw`I_{L,\mathrm{ref}}`,fit.il,String.raw`\mathrm{A}`],
  [String.raw`I_{0,\mathrm{ref}}`,fit.io,String.raw`\mathrm{A}`],
  [String.raw`R_s`,fit.rs,String.raw`\Omega`],
  [String.raw`R_{sh,\mathrm{ref}}`,fit.rsh,String.raw`\Omega`],
  [String.raw`a_{\mathrm{ref}}`,fit.a,String.raw`\mathrm{V}`],
  [String.raw`\alpha_{sc}`,fit.alpha,String.raw`\mathrm{A}/{}^\circ\mathrm{C}`]
 ]);
 fitCards($('fitFixed'),[
  [String.raw`E_{g,\mathrm{ref}}`,referenceConditions.bandgap,String.raw`\mathrm{eV}`],
  [String.raw`\delta_E`,referenceConditions.bandgapCoefficient,String.raw`\mathrm{K}^{-1}`],
  [String.raw`k_B`,referenceConditions.boltzmannEv,String.raw`\mathrm{eV}/\mathrm{K}`]
 ]);
}
function renderIECParameters(model){
 const visible=valid&&model==='iec'&&currentParameters&&result;
 $('iecSection').hidden=!visible;if(!visible)return;
 const q=iecParameters(currentParameters);
 fitCards($('iecParameters'),[
  [String.raw`F_{Fv}`,q.ffv,''],[String.raw`F_{Fi}`,q.ffi,''],
  [String.raw`C_{aq}`,q.caq,''],[String.raw`I_{sc}`,q.isc,String.raw`\mathrm{A}`],
  [String.raw`I_0`,q.io,String.raw`\mathrm{A}`],[String.raw`V_c`,q.voltageScale,String.raw`\mathrm{V}`],
  [String.raw`\alpha_{sc}`,currentParameters.alpha/100,String.raw`{}^\circ\mathrm{C}^{-1}`],
  [String.raw`\beta_{oc}`,currentParameters.beta/100,String.raw`{}^\circ\mathrm{C}^{-1}`],
  [String.raw`R_d`,currentParameters.rd,String.raw`\Omega`]
 ]);
 fitCards($('iecConstants'),[
  [String.raw`C_g`,iecConstants.cg,''],[String.raw`C_v`,iecConstants.cv,''],[String.raw`C_r`,iecConstants.cr,'']
 ]);
}
function equations(model){$('diodeCircuit').hidden=model!=='desoto';$('modelNote').textContent=tr(model==='iec'?'iecNote':'desotoNote');const container=$('eqModel');container.replaceChildren();for(const eq of model==='iec'?iec:desoto){const block=document.createElement('div');math(block,eq,true);container.append(block);}math($('eqArray'),common,true);renderFitParameters(model);renderIECParameters(model);}
function render(){if(!result||!bounds)return;renderFitParameters(form.elements.model.value);renderIECParameters(form.elements.model.value);metrics(result);chart($('ivChart'),result.points,'i',bounds.v,bounds.i,{v:result.vmp,i:result.imp});chart($('pvChart'),result.points,'p',bounds.v,bounds.p,{v:result.vmp,p:result.pmp});drawInspection();}
function drawInspection(){
 for(const id of ['ivChart','pvChart']) $(id).querySelector('.inspection-overlay')?.remove();
 if(inspectIndex===null||!result||!bounds){$('inspection').hidden=true;for(const id of ['ivTooltip','pvTooltip'])$(id).hidden=true;return;}
 inspectIndex=Math.min(inspectIndex,result.points.length-1);
 const point=result.points[inspectIndex];$('inspection').hidden=false;
 $('inspectV').textContent=fmt(point.v);$('inspectI').textContent=fmt(point.i);$('inspectP').textContent=fmt(point.p);
 for(const prefix of ['iv','pv']){$(prefix+'Tooltip').hidden=false;$(prefix+'TipV').textContent=fmt(point.v);$(prefix+'TipI').textContent=fmt(point.i);$(prefix+'TipP').textContent=fmt(point.p);}
 for(const [id,field,ymax] of [['ivChart','i',bounds.i],['pvChart','p',bounds.p]]){
  const {left,top,width,height}=plotArea,x=left+width*point.v/bounds.v,y=top+height*(1-point[field]/ymax),group=text('g',null,{class:'inspection-overlay','pointer-events':'none'});
  group.append(text('line',null,{x1:x,x2:x,y1:top,y2:top+height,stroke:'#9a4e00','stroke-width':1.5,'stroke-dasharray':'5 4'}),text('circle',null,{cx:x,cy:y,r:5,fill:'#9a4e00',stroke:'#fff','stroke-width':2}));
  $(id).append(group);
 }
}
function inspectAtPointer(event){
 if(!result||!bounds)return;
 const svg=event.currentTarget, transform=svg.getScreenCTM();if(!transform)return;
 const position=svg.createSVGPoint();position.x=event.clientX;position.y=event.clientY;
 const local=position.matrixTransform(transform.inverse());
 const {left,top,width,height}=plotArea;
 if(local.x<left||local.x>left+width||local.y<top||local.y>top+height){if(event.pointerType==='mouse'){inspectIndex=null;drawInspection();}return;}
 const voltage=(local.x-left)/width*bounds.v;
 inspectIndex=result.voc>0?Math.round(Math.max(0,Math.min(1,voltage/result.voc))*(result.points.length-1)):0;
 drawInspection();
}
for(const id of ['ivChart','pvChart']){
 const svg=$(id);svg.addEventListener('pointermove',inspectAtPointer);svg.addEventListener('pointerdown',inspectAtPointer);
 svg.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'){inspectIndex=null;drawInspection();}});
 svg.addEventListener('keydown',event=>{if(!result||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();inspectIndex=Math.max(0,Math.min(result.points.length-1,(inspectIndex??0)+(event.key==='ArrowRight'?1:-1)));drawInspection();});
}
function update(recalculateScale=true){valid=false;const model=form.elements.model.value;$('rd-label').hidden=model!=='iec';equations(model);try{const p=read();result=calculate(p,model);currentParameters=p;if(recalculateScale||!bounds)bounds=adjustBounds(p,model);$('error').textContent='';$('metrics').parentElement.hidden=false;valid=true;render();}catch(error){console.warn(error);$('error').textContent=tr(error.message==='fit'?'fitError':'inputError');$('metrics').parentElement.hidden=true;$('fitSection').hidden=true;$('iecSection').hidden=true;}}
function translate(){document.querySelectorAll('[data-m]').forEach(e=>e.textContent=tr(e.dataset.m));document.querySelectorAll('[data-tex]').forEach(e=>math(e,e.dataset.tex));$('ivChart').setAttribute('aria-label',tr('iv'));$('pvChart').setAttribute('aria-label',tr('pv'));equations(form.elements.model.value);if(result)render();}
function updatePresetInfo(){
 const key=$('modulePreset').value,preset=modulePresets[key];
 $('presetExampleNote').hidden=key!=='example';$('presetSource').hidden=!preset;$('presetCellsNote').hidden=!preset;
 if(preset)$('presetSourceLink').href=preset.source;
}
$('modulePreset').addEventListener('change',event=>{
 const key=event.target.value,preset=modulePresets[key];
 if(preset||key==='example'){const data=preset||defaults;for(const field of presetFields)$(field).value=data[field];fit=null;update(true);}
 updatePresetInfo();
});
for(const key of ['irradiance','temperature']){const input=$(key),range=$(key+'Range');range.addEventListener('input',()=>{input.value=range.value;update(false);});input.addEventListener('input',()=>{range.value=input.value;update(false);});}
form.addEventListener('input',e=>{if(e.target.id==='modulePreset')return;if(presetFields.includes(e.target.id)){$('modulePreset').value='custom';updatePresetInfo();}if(!['irradiance','temperature','irradianceRange','temperatureRange'].includes(e.target.id))update(true);});
$('reset').addEventListener('click',()=>{$('modulePreset').value='example';updatePresetInfo();for(const [key,value] of Object.entries(defaults))$(key).value=value;$('irradianceRange').value=defaults.irradiance;$('temperatureRange').value=defaults.temperature;form.querySelector('[value="desoto"]').checked=true;fit=null;update(true);});
document.addEventListener('languagechange',()=>{if(dictionary.en)translate();});
try{const response=await fetch(new URL('./locales.json',import.meta.url));if(!response.ok)throw new Error('locales');dictionary=await response.json();await initialize();translate();update();}catch(error){console.error(error);$('error').textContent='Unable to load.';}
