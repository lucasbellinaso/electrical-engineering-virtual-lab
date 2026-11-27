/** Real special functions and Gaussian probabilities (pure ESM, no dependencies). */

/** Complementary error function, rational Chebyshev approximation of Cody (1969). */
export function erfc(x) {
  if (typeof x !== 'number' || Number.isNaN(x)) throw new TypeError('x deve ser um número.');
  if (x === Infinity) return 0;
  if (x === -Infinity) return 2;
  if (x < 0) return 2 - erfc(-x);
  if (x === 0) return 1;
  if (x > 27) return 0;
  if (x < 0.46875) {
    const a = [3.1611237438705656e0,1.13864154151050156e2,3.77485237685302021e2,3.20937758913846947e3,1.85777706184603153e-1];
    const b = [2.36012909523441209e1,2.44024637934444173e2,1.28261652607737228e3,2.84423683343917062e3];
    const y=x*x, xnum=(((a[4]*y+a[0])*y+a[1])*y+a[2])*y+a[3], xden=(((y+b[0])*y+b[1])*y+b[2])*y+b[3];
    return 1-(x*xnum)/xden;
  }
  if (x <= 4) {
    const c=[5.64188496988670089e-1,8.88314979438837594e0,6.61191906371416295e1,2.98635138197400131e2,8.81952221241769090e2,1.71204761263407058e3,2.05107837782607147e3,1.23033935479799725e3,2.15311535474403846e-8];
    const d=[1.57449261107098347e1,1.17693950891312499e2,5.37181101862009858e2,1.62138957456669019e3,3.29079923573345963e3,4.36261909014324716e3,3.43936767414372164e3,1.23033935480374942e3];
    let xnum=c[8]*x, xden=x;
    for(let i=0;i<7;i++){xnum=(xnum+c[i])*x;xden=(xden+d[i])*x;}
    const res=(xnum+c[7])/(xden+d[7]), ysq=Math.trunc(x*16)/16, del=(x-ysq)*(x+ysq);
    return Math.exp(-ysq*ysq)*Math.exp(-del)*res;
  }
  const p=[3.05326634961232344e-1,3.60344899949804439e-1,1.25781726111229246e-1,1.60837851487422766e-2,6.58749161529837803e-4,1.63153871373020978e-2];
  const q=[2.56852019228982232e0,1.87295284992346047e0,5.27905102951428412e-1,6.05183413124413191e-2,2.33520497626869185e-3];
  const y=1/(x*x); let xnum=p[5]*y, xden=y;
  for(let i=0;i<4;i++){xnum=(xnum+p[i])*y;xden=(xden+q[i])*y;}
  const res=(y*(xnum+p[4]))/(xden+q[4]), corr=(1/Math.sqrt(Math.PI)-res)/x;
  const ysq=Math.trunc(x*16)/16, del=(x-ysq)*(x+ysq);
  return Math.exp(-ysq*ysq)*Math.exp(-del)*corr;
}

/** Error function for real x. */
export function erf(x) {
  if (typeof x !== 'number' || Number.isNaN(x)) throw new TypeError('x deve ser um número.');
  if(Object.is(x,-0))return -0;
  if(Math.abs(x)<0.5){let term=x,sum=x;for(let n=0;n<100;n++){term*=-(x*x)*(2*n+1)/((n+1)*(2*n+3));sum+=term;if(Math.abs(term)<=Number.EPSILON*Math.abs(sum))break;}return 2*sum/Math.sqrt(Math.PI);}
  if (x < 0) return erfc(-x)-1;
  return 1-erfc(x);
}

/** Gaussian Q-function: probability that a standard normal variable exceeds x. */
export function qfunc(x) {
  if (typeof x !== 'number' || Number.isNaN(x)) throw new TypeError('x deve ser um número.');
  return 0.5*erfc(x/Math.SQRT2);
}

/** Standard normal cumulative distribution function. */
export function ndtr(x) {
  if (typeof x !== 'number' || Number.isNaN(x)) throw new TypeError('x deve ser um número.');
  return 0.5*erfc(-x/Math.SQRT2);
}

/** P(a < Z <= b), evaluated with tail probabilities to reduce cancellation. */
export function normalInterval(a,b) {
  if(typeof a!=='number'||typeof b!=='number'||Number.isNaN(a)||Number.isNaN(b)) throw new TypeError('a e b devem ser números.');
  if(a>=b)return 0;
  if(a>=0)return qfunc(a)-qfunc(b);
  if(b<=0)return qfunc(-b)-qfunc(-a);
  return ndtr(b)-ndtr(a);
}

/** Inverse standard normal CDF (Acklam rational approximation + Halley correction). */
export function ndtri(p) {
  if(typeof p!=='number'||Number.isNaN(p))throw new TypeError('p deve ser um número.');
  if(p<0||p>1)throw new RangeError('p deve estar no intervalo [0,1].');
  if(p===0)return -Infinity;if(p===1)return Infinity;if(p===0.5)return 0;
  const a=[-3.969683028665376e1,2.209460984245205e2,-2.759285104469687e2,1.383577518672690e2,-3.066479806614716e1,2.506628277459239];
  const b=[-5.447609879822406e1,1.615858368580409e2,-1.556989798598866e2,6.680131188771972e1,-1.328068155288572e1];
  const c=[-7.784894002430293e-3,-3.223964580411365e-1,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783];
  const d=[7.784695709041462e-3,3.224671290700398e-1,2.445134137142996,3.754408661907416];
  const plow=0.02425,phigh=1-plow;let x;
  if(p<plow){const q=Math.sqrt(-2*Math.log(p));x=(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  else if(p>phigh){const q=Math.sqrt(-2*Math.log1p(-p));x=-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  else {const q=p-0.5,r=q*q;x=(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);}
  const density=Math.exp(-0.5*x*x)/Math.sqrt(2*Math.PI);
  if(density>0){const err=x>=0?(1-p)-qfunc(x):ndtr(x)-p;const u=err/density;x-=u/(1+0.5*x*u);}
  return x;
}
