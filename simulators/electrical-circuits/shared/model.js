/** EEVL ideal linear circuits v1.0.0. Public parameters use Ω, mH, µF, mA, ms.
 * Source is volts except parallel RLC (mA). States and returned samples are SI.
 * A constant post-switch input is applied at t=0+. No pre-switch equilibrium is assumed.
 */
export const VERSION='1.0.0';
export const MAX_STEPS=80000;
export const presets=Object.freeze({
 rc:Object.freeze({topology:'rc',excitation:'step',resistance:1000,inductance:100,capacitance:100,source:5,v0:0,i0:0,duration:500}),
 rl:Object.freeze({topology:'rl',excitation:'step',resistance:100,inductance:100,capacitance:100,source:5,v0:0,i0:0,duration:5}),
 series:Object.freeze({topology:'series',excitation:'step',resistance:20,inductance:100,capacitance:10,source:5,v0:0,i0:0,duration:50}),
 parallel:Object.freeze({topology:'parallel',excitation:'step',resistance:200,inductance:100,capacitance:10,source:25,v0:0,i0:0,duration:50})
});
export class CircuitError extends RangeError{constructor(code){super(code);this.code=code;}}
export function validate(p){
 if(!p||!Object.hasOwn(presets,p.topology)||!['step','natural'].includes(p.excitation))throw new CircuitError('parameters');
 const bounds={resistance:[p.topology==='series'?0:.001,1e9],inductance:[.001,1e6],capacitance:[.001,1e6],source:[-1000,1000],v0:[-1000,1000],i0:[-1e6,1e6],duration:[.000001,1e7]};
 for(const [key,[low,high]] of Object.entries(bounds))if(typeof p[key]!=='number'||!Number.isFinite(p[key])||p[key]<low||p[key]>high)throw new CircuitError('parameters');
 return p;
}
export function characteristics(p){
 validate(p);const R=p.resistance,L=p.inductance*1e-3,C=p.capacitance*1e-6;
 if(['rc','rl'].includes(p.topology)){const tau=p.topology==='rc'?R*C:L/R;return {R,L,C,tau,rate:1/tau,slowRate:1/tau,regime:'firstOrder'};}
 const omega0=1/Math.sqrt(L*C),alpha=p.topology==='series'?R/(2*L):1/(2*R*C),zeta=alpha/omega0;
 const critical=Math.abs(zeta-1)<=1e-12;
 const regime=alpha===0?'undamped':critical?'critical':zeta<1?'underdamped':'overdamped';
 const delta=alpha>omega0?Math.sqrt((alpha-omega0)*(alpha+omega0)):0;
 const rate=alpha>omega0?alpha+delta:omega0,slowRate=alpha>omega0?omega0**2/(alpha+delta):alpha;
 return {R,L,C,omega0,alpha,zeta,rate,slowRate,regime,omegaD:alpha<omega0?Math.sqrt((omega0-alpha)*(omega0+alpha)):0};
}
export function recommendedDuration(p){const c=characteristics(p);return 1000*(c.tau?5*c.tau:c.slowRate>c.omega0*.02?8/c.slowRate:8*2*Math.PI/c.omega0);}
export function input(p){return p.excitation==='natural'?0:p.source*(p.topology==='parallel'?1e-3:1);}
export function initialState(p){return [p.v0,p.i0*1e-3];}
export function derivative(p,state){
 const {R,L,C}=characteristics(p),[v,i]=state,s=input(p);
 switch(p.topology){case 'rc':return [(s-v)/(R*C),0];case 'rl':return [0,(s-R*i)/L];case 'series':return [i/C,(s-R*i-v)/L];case 'parallel':return [(s-v/R-i)/C,v/L];}
}
function derivativeFor(p,c){const {R,L,C}=c,s=input(p);return ([v,i])=>{
 switch(p.topology){case 'rc':return [(s-v)/(R*C),0];case 'rl':return [0,(s-R*i)/L];case 'series':return [i/C,(s-R*i-v)/L];case 'parallel':return [(s-v/R-i)/C,v/L];}
};}
export function rk4Step(state,h,f){
 const k1=f(state),k2=f(state.map((v,j)=>v+h*k1[j]/2)),k3=f(state.map((v,j)=>v+h*k2[j]/2)),k4=f(state.map((v,j)=>v+h*k3[j]));
 return state.map((v,j)=>v+h*(k1[j]+2*k2[j]+2*k3[j]+k4[j])/6);
}
/** y''+2αy'+ω₀²y=0, including critical and zero damping. */
export function homogeneous(y0,d0,alpha,omega0,time){
 const zeta=alpha/omega0;
 if(Math.abs(zeta-1)<=1e-12){const b=d0+alpha*y0,e=Math.exp(-alpha*time);return [e*(y0+b*time),e*(b-alpha*(y0+b*time))];}
 if(alpha<omega0){
  const w=Math.sqrt((omega0-alpha)*(omega0+alpha)),a=y0,b=(d0+alpha*y0)/w,e=Math.exp(-alpha*time),cos=Math.cos(w*time),sin=Math.sin(w*time),y=a*cos+b*sin;
  return [e*y,e*(-alpha*y+w*(-a*sin+b*cos))];
 }
 const d=Math.sqrt((alpha-omega0)*(alpha+omega0)),r1=-(omega0**2)/(alpha+d),r2=-alpha-d,a=(d0-r2*y0)/(r1-r2),b=y0-a,e1=Math.exp(r1*time),e2=Math.exp(r2*time);
 return [a*e1+b*e2,r1*a*e1+r2*b*e2];
}
export function analyticalState(p,time){
 const c=characteristics(p),s=input(p),i0=p.i0*1e-3;
 if(p.topology==='rc')return [s+(p.v0-s)*Math.exp(-time/c.tau),i0];
 if(p.topology==='rl')return [p.v0,s/c.R+(i0-s/c.R)*Math.exp(-time/c.tau)];
 if(p.topology==='series'){const [y,d]=homogeneous(p.v0-s,i0/c.C,c.alpha,c.omega0,time);return [y+s,c.C*d];}
 const [v,d]=homogeneous(p.v0,(s-p.v0/c.R-i0)/c.C,c.alpha,c.omega0,time);return [v,s-v/c.R-c.C*d];
}
function sample(p,c,time,state){
 const [v,i]=state,s=input(p);let vc=0,il=0,vR=0,vL=0,iR=0,iC=0,power=0;
 switch(p.topology){
  case 'rc':vc=v;iR=iC=(s-v)/c.R;vR=s-v;power=s*iR;break;
  case 'rl':il=i;iR=i;vR=c.R*i;vL=s-vR;power=s*i;break;
  case 'series':vc=v;il=i;iR=iC=i;vR=c.R*i;vL=s-vR-v;power=s*i;break;
  case 'parallel':vc=v;il=i;vR=vL=v;iR=v/c.R;iC=s-iR-i;power=s*v;break;
 }
 return {time,vc,il,vR,vL,iR,iC,source:s,energy:.5*c.C*vc**2+.5*c.L*il**2,power,loss:c.R*iR**2};
}
export function simulate(parameters,options={}){
 const p={...validate(parameters)},c=characteristics(p),duration=p.duration*1e-3;
 const refinement=options.refinement??1;if(!Number.isInteger(refinement)||refinement<1||refinement>8)throw new CircuitError('parameters');
 const required=Math.max(800,Math.ceil(duration*c.rate*60))*refinement;
 if(required>MAX_STEPS)throw new CircuitError('resolution');
 const steps=required,h=duration/steps,f=derivativeFor(p,c);let state=initialState(p),errorV=0,errorI=0;
 const samples=[];
 for(let j=0;j<=steps;j++){
  const time=j*h,s=sample(p,c,time,state),exact=sample(p,c,time,analyticalState(p,time));
  if(!Object.values(s).every(Number.isFinite))throw new CircuitError('nonfinite');
  errorV=Math.max(errorV,Math.abs(s.vc-exact.vc),Math.abs(s.vL-exact.vL),Math.abs(s.vR-exact.vR));
  errorI=Math.max(errorI,Math.abs(s.il-exact.il),Math.abs(s.iC-exact.iC),Math.abs(s.iR-exact.iR));
  samples.push({...s,exactVC:exact.vc,exactIL:exact.il});
  if(j<steps)state=rk4Step(state,h,f);
 }
 let work=0,heat=0;for(let j=1;j<samples.length;j++){work+=(samples[j-1].power+samples[j].power)*h/2;heat+=(samples[j-1].loss+samples[j].loss)*h/2;}
 const energyResidual=samples.at(-1).energy-samples[0].energy-work+heat;
 return {parameters:p,characteristics:c,samples,step:h,errorV,errorI,work,heat,energyResidual,version:VERSION};
}
