/** EEVL electrostatics 1.0.0. SI units, vacuum; analytical three-dimensional fields sampled on the plane z=0. DOM-free. */
export const EPS0=8.8541878188e-12; // NIST CODATA 2022, F/m.
export const KE=1/(4*Math.PI*EPS0);
export const MODES=Object.freeze(['charges','sphere','wire','plates']);
export const MATERIALS=Object.freeze(['conductor','insulator']);
export const MAX_CHARGES=8;
export const presets=Object.freeze({
 dipole:[{x:-.8,y:0,q:2},{x:.8,y:0,q:-2}],
 single:[{x:0,y:0,q:2}],
 pair:[{x:-.8,y:0,q:2},{x:.8,y:0,q:2}],
 quadrupole:[{x:-.7,y:.7,q:2},{x:.7,y:.7,q:-2},{x:-.7,y:-.7,q:-2},{x:.7,y:-.7,q:2}]
});
export function createDefaults(){
 return {mode:'charges',charges:presets.dipole.map(c=>({...c})),radius:.7,material:'conductor',strength:2,rref:1,separation:1.5,extent:6};
}
const finite=v=>typeof v==='number'&&Number.isFinite(v);
/** Returns a validated copy; throws RangeError('parameters') for any value outside the documented limits. */
export function validate(input){
 if(!input||!MODES.includes(input.mode)||!MATERIALS.includes(input.material)||!Array.isArray(input.charges))throw new RangeError('parameters');
 const bounds={radius:[.15,1.5],strength:[-10,10],rref:[.01,100],separation:[.2,3],extent:[1,20]};
 for(const [key,[min,max]] of Object.entries(bounds))if(!finite(input[key])||input[key]<min||input[key]>max)throw new RangeError('parameters');
 if(input.charges.length>MAX_CHARGES)throw new RangeError('parameters');
 for(const c of input.charges)if(!c||!finite(c.x)||!finite(c.y)||!finite(c.q)||Math.abs(c.x)>1e6||Math.abs(c.y)>1e6||Math.abs(c.q)>20)throw new RangeError('parameters');
 return {...input,charges:input.charges.map(c=>({...c}))};
}
/**
 * Electric field E (V/m) and potential V (V) at (x,y,0) in metres.
 * Charges are in nC (point charges, sphere Q), nC/m (wire) or nC/m² (plates), as in the user interface.
 * singular=true: the ideal model is undefined there (E and V are NaN). boundary=true: E is discontinuous.
 */
export function fieldAt(x,y,s){
 let ex=0,ey=0,v=0,boundary=false;
 if(s.mode==='charges'){
  for(const c of s.charges){
   const dx=x-c.x,dy=y-c.y,r=Math.hypot(dx,dy),q=c.q*1e-9;
   if(q===0)continue;
   if(r<1e-10)return {ex:NaN,ey:NaN,v:NaN,magnitude:NaN,singular:true,boundary:false};
   ex+=KE*q*dx/r**3;ey+=KE*q*dy/r**3;v+=KE*q/r;
  }
 }else if(s.mode==='sphere'){
  const r=Math.hypot(x,y),R=s.radius,q=s.strength*1e-9;
  if(r>=R){ex=KE*q*x/r**3;ey=KE*q*y/r**3;v=KE*q/r;}
  else if(s.material==='conductor'){v=KE*q/R;}
  else{ex=KE*q*x/R**3;ey=KE*q*y/R**3;v=KE*q*(3*R*R-r*r)/(2*R**3);}
  boundary=s.material==='conductor'&&Math.abs(r-R)<1e-10;
 }else if(s.mode==='wire'){
  const r=Math.hypot(x,y),lambda=s.strength*1e-9;
  if(r<1e-10){if(lambda!==0)return {ex:NaN,ey:NaN,v:NaN,magnitude:NaN,singular:true,boundary:false};}
  else{const k=lambda/(2*Math.PI*EPS0);ex=k*x/r**2;ey=k*y/r**2;v=-k*Math.log(r/s.rref);}
 }else if(s.mode==='plates'){
  const sigma=s.strength*1e-9,d=s.separation;
  // Infinite planes at x=-d/2 (+sigma) and x=+d/2 (-sigma), parallel to yz; sgn(0)=0 gives the mean of the two limits.
  ex=(Math.sign(x+d/2)-Math.sign(x-d/2))*sigma/(2*EPS0);
  v=sigma/(2*EPS0)*(Math.abs(x-d/2)-Math.abs(x+d/2));
  boundary=Math.abs(Math.abs(x)-d/2)<1e-10;
 }
 return {ex,ey,v,magnitude:Math.hypot(ex,ey),singular:false,boundary};
}
/** Cartesian, cylindrical (rho,phi) and spherical (r,theta,phi) description of a probe on z=0 with E components in each local basis. */
export function coordinates(x,y,field){
 const rho=Math.hypot(x,y),defined=rho>1e-12,phi=defined?Math.atan2(y,x):NaN;
 return {x,y,z:0,rho,r:rho,phi,phiDegrees:defined?(phi*180/Math.PI+360)%360:NaN,theta:defined?Math.PI/2:NaN,
  radial:defined?(field.ex*x+field.ey*y)/rho:NaN,azimuthal:defined?(-field.ex*y+field.ey*x)/rho:NaN};
}
/** Field-line seeds for the current configuration; halfHeight is the half-height of the visible window in metres. */
export function seeds(s,halfHeight){
 const out=[];
 if(s.mode==='charges'){
  for(const c of s.charges){if(c.q===0)continue;for(let k=0;k<12;k++){const a=k*Math.PI/6;out.push({x:c.x+.04*Math.cos(a),y:c.y+.04*Math.sin(a),dir:c.q>0?1:-1});}}
 }else if(s.mode==='plates'){
  const step=s.extent/12;for(let y=-halfHeight+.15;y<halfHeight;y+=step)out.push({x:0,y,dir:1},{x:0,y,dir:-1});
 }else{
  const r=s.mode==='sphere'&&s.material==='conductor'?s.radius*1.001:.04;
  for(let k=0;k<24;k++)out.push({x:r*Math.cos(k*Math.PI/12),y:r*Math.sin(k*Math.PI/12),dir:s.strength>=0?1:-1});
 }
 return out;
}
/** Midpoint (RK2) tracing of a geometric field line with fixed spatial step; stops at zero field, window limits or a point charge. */
export function traceLine(seed,s,{step=s.extent/200,maxSteps=500,halfWidth=s.extent/2,halfHeight=s.extent/2}={}){
 const direction=(x,y)=>{const f=fieldAt(x,y,s);return f.magnitude>1e-12&&Number.isFinite(f.magnitude)?[seed.dir*f.ex/f.magnitude,seed.dir*f.ey/f.magnitude]:null;};
 let x=seed.x,y=seed.y;const points=[[x,y]];
 for(let n=0;n<maxSteps;n++){
  const a=direction(x,y);if(!a)break;
  const b=direction(x+step*a[0]/2,y+step*a[1]/2);if(!b)break;
  x+=step*b[0];y+=step*b[1];
  if(Math.abs(x)>halfWidth||Math.abs(y)>halfHeight)break;
  points.push([x,y]);
  if(s.mode==='charges'&&s.charges.some(c=>c.q!==0&&Math.hypot(x-c.x,y-c.y)<.035))break;
 }
 return points;
}
/** Percentile range of log10|E| used to rescale the colour map to the current window (low=10 %, high=97 %). */
export function logRange(magnitudes){
 const logs=[];for(const m of magnitudes)if(m>1e-12&&Number.isFinite(m))logs.push(Math.log10(m));
 logs.sort((a,b)=>a-b);
 let low=logs.length?logs[Math.floor(logs.length*.1)]:-2,high=logs.length?logs[Math.floor(logs.length*.97)]:2;
 if(high-low<1)low=high-1;
 return {low,high};
}
/** Evenly spaced contour levels between the 5 % and 95 % percentiles of the finite potential samples; empty if the potential is flat. */
export function equipotentialLevels(values,count=11){
 const v=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!v.length)return [];
 const lo=v[Math.floor(v.length*.05)],hi=v[Math.floor(v.length*.95)];if(hi-lo<1e-12)return [];
 return Array.from({length:count},(_,j)=>lo+(hi-lo)*(j+1)/(count+1));
}
/** Marching-squares segments of one level on an (n+1)x(m+1) grid; coordinates are fractional grid indices [i,j]. */
export function contourSegments(grid,level){
 const m=grid.length-1,n=grid[0].length-1,segments=[];
 for(let j=0;j<m;j++)for(let i=0;i<n;i++){
  const vs=[grid[j][i],grid[j][i+1],grid[j+1][i+1],grid[j+1][i]],pts=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]],cross=[];
  for(let e=0;e<4;e++){
   const f=(e+1)%4;if(!Number.isFinite(vs[e])||!Number.isFinite(vs[f]))continue;
   if((vs[e]<level)!==(vs[f]<level)){const t=(level-vs[e])/(vs[f]-vs[e]);cross.push([pts[e][0]+t*(pts[f][0]-pts[e][0]),pts[e][1]+t*(pts[f][1]-pts[e][1])]);}
  }
  if(cross.length===2)segments.push(cross);
 }
 return segments;
}
