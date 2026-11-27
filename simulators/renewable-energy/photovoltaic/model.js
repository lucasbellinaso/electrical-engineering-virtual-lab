/** PV module and uniform array using the De Soto single-diode model. */
import {fsolve} from '../../../assets/js/core/solvers.js';

export const defaults=Object.freeze({voc:49.5,isc:13.9,vmp:41.5,imp:13.0,alpha:0.045,beta:-0.275,cells:72,irradiance:1000,temperature:25,series:1,parallel:1,rd:1});
const K=8.617333262145e-5, TREF=298.15, EG=1.121, DEG=-0.0002677;
export const iecConstants=Object.freeze({cg:0.002514,cv:0.08593,cr:0.0001088});
export const referenceConditions=Object.freeze({irradiance:1000,temperature:25,bandgap:EG,bandgapCoefficient:DEG,boltzmannEv:K});
function fail(message){throw new RangeError(message);}
export function validate(p){
 for(const key of Object.keys(defaults))if(typeof p[key]!=='number'||!Number.isFinite(p[key]))fail('invalid');
 if(!(p.voc>0&&p.isc>0&&p.vmp>0&&p.vmp<p.voc&&p.imp>0&&p.imp<p.isc))fail('datasheet');
 if(!(p.alpha>=0&&p.alpha<=1&&p.beta>=-2&&p.beta<0))fail('coefficients');
 if(!(p.rd>0&&p.rd<=100000))fail('invalid');
 if(!Number.isInteger(p.cells)||p.cells<1||p.cells>300)fail('cells');
 if(p.irradiance<0||p.irradiance>1400||p.temperature< -40||p.temperature>100)fail('environment');
 if(!Number.isInteger(p.series)||p.series<1||p.series>100||!Number.isInteger(p.parallel)||p.parallel<1||p.parallel>100)fail('array');
 return {...p};
}
/** Fit 5 reference parameters from the four STC points and Voc temperature coefficient. */
export function fitModule(input){
 const p=validate(input), alpha=p.alpha*p.isc/100, beta=p.beta*p.voc/100;
 const a0=1.5*K*TREF*p.cells, io0=p.isc*Math.exp(-p.voc/a0);
 const rs0=Math.max(0.001,(a0*Math.log1p((p.isc-p.imp)/io0)-p.vmp)/p.imp);
 const initial=[p.isc,Math.log(io0),Math.log(rs0),Math.log(100),Math.log(a0)];
 function equations(v){
  const [il,lio,lrs,lrsh,la]=v,io=Math.exp(lio),rs=Math.exp(lrs),rsh=Math.exp(lrsh),a=Math.exp(la);
  const diode=(u)=>io*Math.expm1(Math.min(u/a,700));
  const u=p.vmp+p.imp*rs, term=io*Math.exp(Math.min(u/a,700))/a+1/rsh;
  const t2=TREF+2,a2=a*t2/TREF,il2=il+2*alpha,eg2=EG*(1+DEG*2),io2=io*(t2/TREF)**3*Math.exp((EG/TREF-eg2/t2)/K),voc2=p.voc+2*beta;
  return [(p.isc-il+diode(p.isc*rs)+p.isc*rs/rsh)/p.isc,(-il+diode(p.voc)+p.voc/rsh)/p.isc,(p.imp-il+diode(u)+u/rsh)/p.isc,(p.imp-p.vmp*term/(1+rs*term))/p.isc,(-il2+io2*Math.expm1(Math.min(voc2/a2,700))+voc2/rsh)/p.isc];
 }
 const result=fsolve(equations,initial,{lineSearch:true,maxIter:350,tolFun:1e-10,diffType:'central'});
 if(result.exitflag!==1)fail('fit');
 const [il,lio,lrs,lrsh,la]=result.x, fit={il,io:Math.exp(lio),rs:Math.exp(lrs),rsh:Math.exp(lrsh),a:Math.exp(la),alpha};
 if(Object.values(fit).some(v=>!Number.isFinite(v))||fit.il<=0||fit.io<=0||fit.rs<=0||fit.rsh<=0||fit.a<=0)fail('fit');
 return fit;
}
function bisect(f,lo,hi){for(let i=0;i<75;i++){const m=(lo+hi)/2;if(f(m)>0)hi=m;else lo=m;}return (lo+hi)/2;}
export function simulate(input,fit=fitModule(input)){
 const p=validate(input), count=201;
 if(p.irradiance===0){return {points:[{v:0,i:0,p:0}],isc:0,voc:0,imp:0,vmp:0,pmp:0,module:{isc:0,voc:0,imp:0,vmp:0,pmp:0}};}
 const temperature=p.temperature+273.15,g=p.irradiance/1000, il=g*(fit.il+fit.alpha*(p.temperature-25)),eg=EG*(1+DEG*(temperature-TREF));
 const io=fit.io*(temperature/TREF)**3*Math.exp((EG/TREF-eg/temperature)/K),a=fit.a*temperature/TREF,rsh=fit.rsh/g,rs=fit.rs;
 const diode=u=>io*Math.expm1(Math.min(u/a,700));
 const voc=bisect(v=>diode(v)+v/rsh-il,0,Math.max(p.voc*4,a*Math.log1p(il/io)*2));
 const current=v=>bisect(i=>i+diode(v+i*rs)+(v+i*rs)/rsh-il,0,Math.max(il,0));
 const isc=current(0);let lo=0,hi=voc;
 for(let n=0;n<80;n++){const a1=lo+(hi-lo)*0.3819660112501051,b1=hi-(hi-lo)*0.3819660112501051;if(a1*current(a1)<b1*current(b1))lo=a1;else hi=b1;}
 const vmp=(lo+hi)/2,imp=current(vmp),pmp=vmp*imp;
 const points=Array.from({length:count},(_,k)=>{const v=voc*k/(count-1),i=k===count-1?0:current(v);return {v:v*p.series,i:i*p.parallel,p:v*i*p.series*p.parallel};});
 const module={isc,voc,vmp,imp,pmp};return {points,isc:isc*p.parallel,voc:voc*p.series,vmp:vmp*p.series,imp:imp*p.parallel,pmp:pmp*p.series*p.parallel,module};
}

/** User-supplied IEC 62891-style model; temperature coefficients are percent per degree C. */
export function iecParameters(input) {
 const p=validate(input), g=p.irradiance/1000, dv=p.temperature-25, ffv=p.vmp/p.voc, ffi=p.imp/p.isc;
 if(g===0)return {isc:0,voltageScale:0,io:0,caq:(ffv-1)/Math.log1p(-ffi),ffv,ffi};
 const isc=p.isc*g*(1+p.alpha/100*dv);
 const voltageScale=p.voc*(1+p.beta/100*dv)*(Math.log1p(p.irradiance/iecConstants.cg)*iecConstants.cv-iecConstants.cr*p.irradiance);
 const io=p.isc*Math.pow(1-ffi,1/(1-ffv))*g, caq=(ffv-1)/Math.log1p(-ffi);
 if(!(isc>0&&voltageScale>0&&io>0&&caq>0)||![isc,voltageScale,io,caq].every(Number.isFinite))fail('iec');
 return {isc,voltageScale,io,caq,ffv,ffi};
}
/** Current of one module; rd is used only for negative voltage. */
export function iecCurrentAtVoltage(voltage,input,rd=input.rd){
 if(typeof voltage!=='number'||!Number.isFinite(voltage)||!Number.isFinite(rd)||rd<=0)fail('invalid');
 const p=iecParameters(input);
 if(voltage<=0)return p.isc-voltage/rd;
 if(p.isc===0)return 0;
 return p.isc+p.io-p.io*Math.exp(voltage/(p.voltageScale*p.caq));
}
/** Voltage of one module; rd is used only above short-circuit current. */
export function iecVoltageAtCurrent(current,input,rd=input.rd){
 if(typeof current!=='number'||!Number.isFinite(current)||!Number.isFinite(rd)||rd<=0)fail('invalid');
 const p=iecParameters(input);
 if(p.isc===0)return current>0?-current*rd:0;
 const excess=Math.max(0,current-p.isc),limited=Math.min(current,p.isc);
 return p.voltageScale*p.caq*Math.log1p((p.isc-limited)/p.io)-excess*rd;
}
export function simulateIEC(input){
 const p=validate(input), q=iecParameters(p), count=201;
 if(q.isc===0)return {points:[{v:0,i:0,p:0}],isc:0,voc:0,imp:0,vmp:0,pmp:0,module:{isc:0,voc:0,imp:0,vmp:0,pmp:0}};
 const voc=q.voltageScale*q.caq*Math.log1p(q.isc/q.io);
 const current=v=>v===0?q.isc:q.isc-q.io*Math.expm1(v/(q.voltageScale*q.caq));
 let lo=0,hi=voc;
 for(let n=0;n<80;n++){const a=lo+(hi-lo)*0.3819660112501051,b=hi-(hi-lo)*0.3819660112501051;if(a*current(a)<b*current(b))lo=a;else hi=b;}
 const vmp=(lo+hi)/2,imp=current(vmp),pmp=vmp*imp;
 const points=Array.from({length:count},(_,k)=>{const v=voc*k/(count-1),i=k===count-1?0:current(v);return {v:v*p.series,i:i*p.parallel,p:v*i*p.series*p.parallel};});
 return {points,isc:q.isc*p.parallel,voc:voc*p.series,vmp:vmp*p.series,imp:imp*p.parallel,pmp:pmp*p.series*p.parallel,module:{isc:q.isc,voc,vmp,imp,pmp}};
}

/** Compare array results to the user-supplied module STC data scaled to the same array. */
export function compareCatalog(input, result) {
 const p=validate(input), reference={voc:p.voc*p.series,isc:p.isc*p.parallel,vmp:p.vmp*p.series,imp:p.imp*p.parallel,pmp:p.vmp*p.imp*p.series*p.parallel};
 return Object.fromEntries(Object.entries(reference).map(([key,base])=>{
  const difference=result[key]-base;return [key,{reference:base,difference,percent:100*difference/base}];
 }));
}
