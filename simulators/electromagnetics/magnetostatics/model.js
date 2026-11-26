/** EEVL magnetostatics 1.0.0. All public quantities in SI. DOM-free. */
export const MU0=1.25663706127e-6; // NIST CODATA 2022, H/m.
export const defaults=Object.freeze({mode:'wires',arrangement:'single',current:10,muR:1,radius:.45,wireRadius:.04,separation:.9,length:1.4,turns:20,segments:128,extent:3});
export function validate(input){
 if(!input||!['wires','loop','solenoid'].includes(input.mode)||!['single','parallel','opposed'].includes(input.arrangement))throw new RangeError('parameters');
 const bounds={current:[-1000,1000],muR:[1,1000],radius:[.1,1.5],wireRadius:[.005,.15],separation:[.2,3],length:[.2,4],turns:[1,80],extent:[1,8]};
 for(const [key,[min,max]]of Object.entries(bounds))if(typeof input[key]!=='number'||!Number.isFinite(input[key])||input[key]<min||input[key]>max)throw new RangeError('parameters');
 if(!Number.isInteger(input.turns)||![64,128,256].includes(input.segments))throw new RangeError('parameters');
 if(input.mode!=='wires'&&input.wireRadius>input.radius*.15)throw new RangeError('thinWire');
 if(input.mode==='wires'&&input.arrangement!=='single'&&input.separation<=2*input.wireRadius)throw new RangeError('overlap');
 return {...input};
}
export function sources(p){
 if(p.mode==='wires')return p.arrangement==='single'?[{x:0,y:0,current:p.current}]:[{x:-p.separation/2,y:0,current:p.current},{x:p.separation/2,y:0,current:p.current*(p.arrangement==='opposed'?-1:1)}];
 return Array.from({length:p.mode==='loop'?1:p.turns},(_,j)=>({z:p.mode==='loop'?0:-p.length/2+(j+.5)*p.length/p.turns}));
}
function packed(bx,by,bz,p,excluded=false){const magnitude=Math.hypot(bx,by,bz),mu=MU0*p.muR;return {bx,by,bz,magnitude,hx:bx/mu,hy:by/mu,hz:bz/mu,hMagnitude:magnitude/mu,excluded};}
export function createEvaluator(parameters){
 const p=validate(parameters),mu=MU0*p.muR,geometry=sources(p);
 const angles=Array.from({length:p.segments},(_,j)=>{const a=(j+.5)*2*Math.PI/p.segments;return {c:Math.cos(a),s:Math.sin(a)};});
 return function evaluate(x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y))throw new RangeError('position');
  let bx=0,by=0,bz=0;
  if(p.mode==='wires'){
   for(const wire of geometry){const dx=x-wire.x,dy=y-wire.y,factor=mu*wire.current/(2*Math.PI*Math.max(dx*dx+dy*dy,p.wireRadius**2));bx-=factor*dy;by+=factor*dx;}
  }else{
   for(const ring of geometry){
    const z=y-ring.z;
    // The thin-filament model has no interior solution: exclude a physical-looking tube.
    if(Math.hypot(Math.abs(x)-p.radius,z)<=p.wireRadius)return packed(NaN,NaN,NaN,p,true);
    if(p.current===0)continue;
    for(const {c,s}of angles){
     const dx=x-p.radius*c,dy=-p.radius*s,r2=dx*dx+dy*dy+z*z;
     const f=mu*p.current*p.radius/(2*p.segments*r2*Math.sqrt(r2));
     bx+=f*c*z;bz+=f*(p.radius-x*c);
    }
   }
  }
  return packed(bx,by,bz,p);
 };
}
export function fieldAt(x,y,p=defaults){return createEvaluator(p)(x,y);}
export function loopAxis(z,radius,current,muR=1){return MU0*muR*current*radius**2/(2*(radius**2+z*z)**1.5);}
export function continuousSolenoidAxis(z,p){
 const {radius:a,length:l,current:I,turns:N,muR}=p;
 const top=z+l/2,bottom=z-l/2;
 return MU0*muR*N*I/(2*l)*(top/Math.hypot(a,top)-bottom/Math.hypot(a,bottom));
}
export function coordinates(x,y,p,field){
 if(p.mode==='wires'){
  const rho=Math.hypot(x,y),phi=Math.atan2(y,x),c=rho?x/rho:1,s=rho?y/rho:0;
  return {x,y,z:0,rho,phi,radial:field.bx*c+field.by*s,azimuthal:-field.bx*s+field.by*c,axial:0};
 }
 return {x,y:0,z:y,rho:Math.abs(x),phi:x<0?Math.PI:0,radial:Math.sign(x)*field.bx,azimuthal:0,axial:field.bz};
}
export function traceLine(evaluate,p,seed,{step=p.extent/140,maxSteps=240,direction=1}={}){
 if(!(step>0)||!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>2000)throw new RangeError('trace');
 const points=[[...seed]],half=p.extent/2;let [x,y]=seed;
 const unit=(a,b)=>{const f=evaluate(a,b);if(f.excluded||f.magnitude<1e-22)return null;return [f.bx/f.magnitude,(p.mode==='wires'?f.by:f.bz)/f.magnitude];};
 for(let j=0;j<maxSteps;j++){
  const u=unit(x,y);if(!u)break;const v=unit(x+direction*step*u[0]/2,y+direction*step*u[1]/2);if(!v)break;
  const nx=x+direction*step*v[0],ny=y+direction*step*v[1];if(Math.abs(nx)>half||Math.abs(ny)>half)break;
  if(evaluate(nx,ny).excluded)break;x=nx;y=ny;points.push([x,y]);
  if(j>25&&Math.hypot(x-seed[0],y-seed[1])<step*.8)break;
 }
 return points;
}
export function sampleMap(parameters,{size=51,lines=true}={}){
 const p=validate(parameters);if(!Number.isInteger(size)||size<9||size>65)throw new RangeError('resolution');
 const evaluate=createEvaluator(p),half=p.extent/2,grid=[];let maximum=0,excluded=0;
 for(let row=0;row<size;row++)for(let col=0;col<size;col++){
  const x=-half+p.extent*col/(size-1),y=half-p.extent*row/(size-1),f=evaluate(x,y);
  if(f.excluded)excluded++;else maximum=Math.max(maximum,f.magnitude);
  grid.push({x,y,...f});
 }
 const fieldLines=[];
 if(lines&&p.current!==0){
  const seeds=p.mode==='wires'?sources(p).flatMap(w=>[.14,.28,.45].map((r,j)=>[w.x+r*p.extent,w.y+j*.07*p.extent])):Array.from({length:6},(_,j)=>[(j+.5)*p.radius/6,0]);
  for(const seed of seeds){
   if(Math.abs(seed[0])>half||Math.abs(seed[1])>half)continue;
   const limit=p.mode==='solenoid'?130:260;
   const backwards=traceLine(evaluate,p,seed,{direction:-1,maxSteps:limit}).reverse(),forwards=traceLine(evaluate,p,seed,{direction:1,maxSteps:limit});
   fieldLines.push([...backwards.slice(0,-1),...forwards]);
  }
 }
 return {parameters:p,size,grid,maximum,excluded,fieldLines};
}
