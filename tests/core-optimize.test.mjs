import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {minimize, leastSquares, curveFit} from '../assets/js/core/optimize.js';
const ref=JSON.parse(readFileSync(new URL('./fixtures/optimize-scipy.json',import.meta.url),'utf8'));
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<tol, `${a} != ${b}`);
test('BFGS minimizes Rosenbrock against SciPy',()=>{
 const r=minimize(([x,y])=>100*(y-x*x)**2+(1-x)**2,[-1.2,1]);
 assert.equal(r.success,true);r.x.forEach((x,i)=>near(x,ref.minimize.x[i],1e-5));near(r.fun,ref.minimize.fun,1e-10);
});
test('least squares supports non-square residuals and analytic Jacobians',()=>{
 const f=([x,y])=>[x+y-3,2*x-y,x-1.2];
 for(const options of [{},{jacobian:()=>[[1,1],[2,-1],[1,0]]}]){
  const r=leastSquares(f,[0,0],options);assert.equal(r.success,true);r.x.forEach((x,i)=>near(x,ref.leastSquares.x[i],1e-7));near(r.cost,ref.leastSquares.cost,1e-10);
 }
});
test('curve fit estimates parameters and covariance against SciPy',()=>{
 const {x,y,params,covariance}=ref.curveFit;
 const r=curveFit((x,[a,b])=>a*Math.exp(b*x),x,y,[2,-0.5]);
 assert.equal(r.success,true);r.params.forEach((v,i)=>near(v,params[i],1e-6));
 r.covariance.forEach((row,i)=>row.forEach((v,j)=>near(v,covariance[i][j],1e-6)));
});
test('limits and invalid inputs report errors and failure',()=>{
 assert.throws(()=>minimize(x=>x[0],[NaN]));assert.throws(()=>leastSquares(x=>[1],[0],{tol:0}));
 assert.throws(()=>curveFit((x,p)=>p[0]*x,[1],[1,2],[1]));
 assert.equal(minimize(([x,y])=>100*(y-x*x)**2+(1-x)**2,[-1.2,1],{maxIter:1}).status,'max_iterations');
 const r=curveFit((x,[a,b])=>a+b*x,[1,1,1],[1,2,3],[1,1]);assert.equal(r.covariance,null);
});

test('evaluation budget includes numerical gradients without exceeding limit',()=>{
 let calls=0;const r=minimize(x=>{calls++;return (x[0]-3)**2;},[0],{maxEval:2,history:true});
 assert.equal(r.status,'max_evaluations');assert.equal(r.success,false);assert.equal(r.evaluations,2);assert.equal(calls,2);assert.equal(r.fun,9);assert.equal(r.gradient,null);
});
test('strong Wolfe search expands short initial steps and reports diagnostics',()=>{
 const f=([x])=>0.0001*(x-10)**2, gradient=([x])=>[0.0002*(x-10)];
 const r=minimize(f,[0],{gradient,history:true,tol:1e-9});
 assert.equal(r.success,true);near(r.x[0],10,1e-6);assert.ok(r.gradientEvaluations>0);assert.equal(r.history.length,r.iterations+1);assert.equal(r.hessInv.length,1);
 for(let i=1;i<r.history.length;i++){const prev=r.history[i-1],next=r.history[i];const step=next.x[0]-prev.x[0];
  assert.ok(next.fun<=prev.fun+1e-4*prev.gradient[0]*step+1e-15);
  assert.ok(Math.abs(next.gradient[0]*step)<=0.9*Math.abs(prev.gradient[0]*step)+1e-15);
 }
});
test('invalid search parameters and budgets are rejected',()=>{
 for(const options of [{maxEval:0},{maxEval:1.5},{c1:0},{c1:0.9,c2:0.5},{history:'yes'}])assert.throws(()=>minimize(x=>x[0]**2,[1],options));
});
