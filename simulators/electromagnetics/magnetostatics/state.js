import {defaults,validate} from './model.js';
export const defaultView=Object.freeze({heat:true,vectors:true,lines:true,log:true,coordinates:'cartesian'});
export function parseState(search=''){
 const q=new URLSearchParams(search),p={...defaults},view={...defaultView},probe={x:.3,y:.2};
 for(const key of Object.keys(p))if(q.has(key)){const v=q.get(key);p[key]=['mode','arrangement'].includes(key)?v:v.trim()===''?NaN:Number(v);}
 validate(p);
 for(const key of ['heat','vectors','lines','log'])if(q.has(key)){if(!['0','1'].includes(q.get(key)))throw new RangeError('parameters');view[key]=q.get(key)==='1';}
 if(q.has('coordinates')){if(!['cartesian','cylindrical'].includes(q.get('coordinates')))throw new RangeError('parameters');view.coordinates=q.get('coordinates');}
 for(const key of ['x','y'])if(q.has('probe'+key)){const v=q.get('probe'+key);probe[key]=v.trim()===''?NaN:Number(v);}
 if(!Object.values(probe).every(v=>Number.isFinite(v)&&Math.abs(v)<=10000))throw new RangeError('position');
 return {parameters:p,view,probe};
}
export function serializeState(parameters,probe,view){
 const q=new URLSearchParams(validate(parameters));q.set('probex',probe.x);q.set('probey',probe.y);
 for(const key of ['heat','vectors','lines','log'])q.set(key,view[key]?'1':'0');q.set('coordinates',view.coordinates);
 parseState(q.toString());return q.toString();
}
