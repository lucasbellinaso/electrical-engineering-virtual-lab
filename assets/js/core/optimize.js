/** Unconstrained real optimization and nonlinear least squares. */
import {numjac} from './solvers.js';
import {msolve, pinv, rank} from './matrix.js';

const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=v=>Math.sqrt(dot(v,v));
function vector(v,name) {
  if(!Array.isArray(v)||!v.length||v.some(x=>typeof x!=='number'||!Number.isFinite(x))) throw new TypeError(`${name} must be a nonempty finite real array`);
  return v.slice();
}
function settings(options) {
  if(!options||typeof options!=='object'||Array.isArray(options)) throw new TypeError('options must be an object');
  const maxIter=options.maxIter??500, tol=options.tol??1e-8;
  if(!Number.isInteger(maxIter)||maxIter<1||!Number.isFinite(tol)||tol<=0) throw new RangeError('Invalid maxIter or tol');
  return {maxIter,tol};
}
function matrix(J,m,n) {
  if(!Array.isArray(J)||J.length!==m||J.some(r=>!Array.isArray(r)||r.length!==n||r.some(v=>typeof v!=='number'||!Number.isFinite(v)))) throw new TypeError('Invalid Jacobian');
  return J;
}
/** BFGS with a strong-Wolfe line search and an objective-evaluation budget. */
export function minimize(fun,x0,options={}) {
  if(typeof fun!=='function') throw new TypeError('fun must be a function');
  const {maxIter,tol}=settings(options);
  const maxEval=options.maxEval??Infinity, c1=options.c1??1e-4, c2=options.c2??0.9;
  if(maxEval!==Infinity && (!Number.isInteger(maxEval)||maxEval<1)) throw new RangeError('maxEval must be a positive integer');
  if(!Number.isFinite(c1)||!Number.isFinite(c2)||!(0<c1&&c1<c2&&c2<1)) throw new RangeError('Require 0 < c1 < c2 < 1');
  if(options.gradient!==undefined&&typeof options.gradient!=='function') throw new TypeError('gradient must be a function');
  if(options.history!==undefined&&typeof options.history!=='boolean') throw new TypeError('history must be boolean');
  let x=vector(x0,'x0'), n=x.length, evaluations=0, gradientEvaluations=0, iterations=0;
  let value, g=null, H=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>+(i===j)));
  const history=[], budget=Symbol('budget');
  const f=z=>{
    if(evaluations>=maxEval) throw budget;
    evaluations++;
    const y=fun(z.slice());
    if(typeof y!=='number') throw new TypeError('Objective must return a number');
    return y;
  };
  const grad=z=>{
    gradientEvaluations++;
    const result=options.gradient?vector(options.gradient(z.slice()),'gradient'):numjac(v=>[f(v)],z,{diffType:'central'})[0];
    if(result.length!==n)throw new RangeError('gradient dimension mismatch');
    if(result.some(v=>!Number.isFinite(v)))throw new RangeError('gradient must be finite');
    return result;
  };
  const snapshot=(details={})=>({x:x.slice(),fun:value,gradient:g?.slice()??null,evaluations,...details});
  const finish=(success,status)=>({x:x.slice(),fun:value,gradient:g?.slice()??null,success,status,iterations,evaluations,gradientEvaluations,hessInv:H.map(row=>row.slice()),...(options.history?{history:history.slice()}: {})});
  try {
    value=f(x);
    if(!Number.isFinite(value))throw new RangeError('Initial objective must be finite');
    if(options.history)history.push(snapshot());
    g=grad(x);
    if(options.history)history[0]=snapshot();
    for(iterations=0;iterations<maxIter;iterations++) {
      if(Math.max(...g.map(Math.abs))<=tol)return finish(true,'converged');
      let p=H.map(row=>-dot(row,g)), slope=dot(g,p);
      if(!(slope<0)){p=g.map(v=>-v);slope=-dot(g,g);H=H.map((row,i)=>row.map((_,j)=>+(i===j)));}
      const evaluate=alpha=>{
        const point=x.map((v,i)=>v+alpha*p[i]), val=f(point);
        if(!Number.isFinite(val))return {alpha,point,val,gradient:null,derivative:NaN};
        const gradient=grad(point);
        return {alpha,point,val,gradient,derivative:dot(gradient,p)};
      };
      const armijo=t=>Number.isFinite(t.val)&&t.val<=value+c1*t.alpha*slope;
      const wolfe=t=>armijo(t)&&Math.abs(t.derivative)<=-c2*slope;
      const zoom=(left,right)=>{
        for(let k=0;k<40;k++){
          const alpha=(left.alpha+right.alpha)/2;
          if(alpha===left.alpha||alpha===right.alpha)return null;
          const trial=evaluate(alpha);
          if(!armijo(trial)||trial.val>=left.val)right=trial;
          else {
            if(wolfe(trial))return trial;
            if(trial.derivative*(right.alpha-left.alpha)>=0)right=left;
            left=trial;
          }
        }
        return null;
      };
      let previous={alpha:0,val:value,derivative:slope}, trial=null, alpha=1;
      for(let k=0;k<40;k++){
        const current=evaluate(alpha);
        if(!armijo(current)||(k>0&&current.val>=previous.val)){trial=zoom(previous,current);break;}
        if(wolfe(current)){trial=current;break;}
        if(current.derivative>=0){trial=zoom(current,previous);break;}
        previous=current;alpha*=2;
      }
      if(!trial)return finish(false,'line_search_failed');
      const step=trial.point.map((v,i)=>v-x[i]),y=trial.gradient.map((v,i)=>v-g[i]),ys=dot(y,step);
      if(ys>Number.EPSILON*norm(y)*norm(step)) {
        const Hy=H.map(row=>dot(row,y)),yHy=dot(y,Hy),factor=(ys+yHy)/(ys*ys);
        H=H.map((row,i)=>row.map((v,j)=>v+factor*step[i]*step[j]-(Hy[i]*step[j]+step[i]*Hy[j])/ys));
      }
      x=trial.point;value=trial.val;g=trial.gradient;
      if(options.history)history.push(snapshot({direction:p.slice(),stepSize:trial.alpha}));
    }
    if(Math.max(...g.map(Math.abs))<=tol)return finish(true,'converged');
    return finish(false,'max_iterations');
  } catch(error) {
    if(error===budget)return finish(false,'max_evaluations');
    throw error;
  }
}
/** Damped Gauss-Newton (Levenberg-Marquardt), minimizing 1/2 sum(residual^2). */
export function leastSquares(fun,x0,options={}) {
  if(typeof fun!=='function')throw new TypeError('fun must be a function');
  const {maxIter,tol}=settings(options);let x=vector(x0,'x0'),evaluations=0,lambda=1e-3;
  if(options.jacobian!==undefined&&typeof options.jacobian!=='function')throw new TypeError('jacobian must be a function');
  let size;
  const residual=z=>{evaluations++;const v=vector(fun(z.slice()),'residual');if(size!==undefined&&v.length!==size)throw new RangeError('residual dimension changed');return v;};
  let r=residual(x);size=r.length;let cost=dot(r,r)/2;
  const jac=z=>matrix(options.jacobian?options.jacobian(z.slice()):numjac(residual,z,{diffType:'central'}),size,x.length);
  let J=jac(x);
  for(let iter=0;iter<maxIter;iter++) {
    const n=x.length,g=Array.from({length:n},(_,j)=>r.reduce((a,v,i)=>a+J[i][j]*v,0));
    if(Math.max(...g.map(Math.abs))<=tol)return {x,fun:r,cost,jac:J,success:true,status:'converged',iterations:iter,evaluations};
    const A=Array.from({length:n},(_,j)=>Array.from({length:n},(_,k)=>J.reduce((a,row)=>a+row[j]*row[k],0)+(j===k?lambda:0)));
    let step;try{step=msolve(A,g.map(v=>[-v])).map(row=>row[0]);}catch{lambda*=10;continue;}
    if(norm(step)<=tol*(1+norm(x))){const success=Math.max(...g.map(Math.abs))<=Math.sqrt(tol)*(1+norm(r));return {x,fun:r,cost,jac:J,success,status:success?'step_converged':'step_too_small',iterations:iter,evaluations};}
    const next=x.map((v,i)=>v+step[i]);let nr,nc;
    try{nr=residual(next);nc=dot(nr,nr)/2;}catch(e){if(!(e instanceof RangeError))throw e;lambda*=10;continue;}
    if(nc<cost){x=next;r=nr;cost=nc;J=jac(x);lambda=Math.max(lambda/3,1e-15);}else lambda=Math.min(lambda*10,1e30);
  }
  return {x,fun:r,cost,jac:J,success:false,status:'max_iterations',iterations:maxIter,evaluations};
}
/** Fit model(x, params) to real data by least squares; unweighted, without bounds. */
export function curveFit(model,xdata,ydata,p0,options={}) {
  if(typeof model!=='function')throw new TypeError('model must be a function');
  const xs=vector(xdata,'xdata'),ys=vector(ydata,'ydata');if(xs.length!==ys.length)throw new RangeError('data lengths differ');
  const result=leastSquares(p=>xs.map((x,i)=>model(x,p)-ys[i]),p0,options);
  const n=result.x.length,m=xs.length;let covariance=null;
  if(result.success&&m>n&&rank(result.jac)===n){const inverse=pinv(result.jac), scale=2*result.cost/(m-n);covariance=inverse.map(row=>inverse.map(other=>dot(row,other)*scale));}
  return {...result,params:result.x,covariance};
}
