import {minimize} from '../../../assets/js/core/optimize.js';
export const functions = {
 square:{dimension:1,initial:[-3.8],minima:[[0]],range:[-4,4],fn:([x])=>x*x,gradient:([x])=>[2*x],latex:'f(x)=x^2'},
 shifted:{dimension:1,initial:[-3.8],minima:[[2]],range:[-4,6],fn:([x])=>(x-2)**2+1,gradient:([x])=>[2*(x-2)],latex:'f(x)=(x-2)^2+1'},
 bowl:{dimension:2,initial:[-3.8,3.8],minima:[[0,0]],range:[-4,4],fn:([x,y])=>x*x+y*y,gradient:([x,y])=>[2*x,2*y],latex:'f(x,y)=x^2+y^2'},
 rosenbrock:{dimension:2,initial:[-1.8,1.8],minima:[[1,1]],range:[-2,2],fn:([x,y])=>(1-x)**2+100*(y-x*x)**2,gradient:([x,y])=>[-2*(1-x)-400*x*(y-x*x),200*(y-x*x)],latex:'f(x,y)=(1-x)^2+100(y-x^2)^2'},
 doublewell:{dimension:2,initial:[1.1,1.6],minima:[[-1.0355787140888542,0]],localMinima:[[0.9601495555191059,0]],range:[-2,2],fn:([x,y])=>(x*x-1)**2+0.3*x+y*y,gradient:([x,y])=>[4*x*(x*x-1)+0.3,2*y],latex:'f(x,y)=(x^2-1)^2+0.3x+y^2'},
 himmelblau:{dimension:2,initial:[0,0],minima:[[3,2],[-2.805118,3.131312],[-3.77931,-3.283186],[3.584428,-1.848126]],range:[-5,5],fn:([x,y])=>(x*x+y-11)**2+(x+y*y-7)**2,gradient:([x,y])=>[4*x*(x*x+y-11)+2*(x+y*y-7),2*(x*x+y-11)+4*y*(x+y*y-7)],latex:'f(x,y)=(x^2+y-11)^2+(x+y^2-7)^2'}
};
export function solve(id, initial, options={}) {
 const spec=functions[id];if(!spec||!Array.isArray(initial)||initial.length!==spec.dimension||initial.some(v=>!Number.isFinite(v)))throw new RangeError('invalid input');
 return minimize(spec.fn,initial,{...options,gradient:spec.gradient,history:true});
}

/** Fixed display length conveys direction while keeping actual gradient in the history. */
export function gradientArrow(gradient, range) {
 if (!gradient || gradient.some(value => !Number.isFinite(value))) return null;
 const magnitude=Math.hypot(...gradient);
 if (magnitude===0) return null;
 const length=(range[1]-range[0])*0.08;
 return gradient.map(value=>value/magnitude*length);
}
