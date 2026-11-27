/**
 * EEVL · Núcleo numérico puro (vetores de números reais) · v1.0.0
 *
 * Funções elementares de análise numérica com semântica de MATLAB/GNU Octave quando há nome
 * equivalente. Vetores são Array ou Float64Array de números finitos, em unidades SI.
 * Índices são 0-based no código (MATLAB/Octave documentam em 1-based).
 *
 * Hipóteses e normalizações:
 * - trapz/cumtrapz: regra do trapézio composta, ∫y dx ≈ Σ (x[i+1] − x[i])·(y[i] + y[i+1])/2.
 *   Com um único vetor de argumento, o espaçamento é unitário (Δx = 1). x não precisa ser
 *   crescente (o resultado é então orientado, como em MATLAB).
 * - std: desvio-padrão amostral, normalização N − 1 (padrão de MATLAB/Octave).
 * - interp1: interpolação linear por partes. x deve ser estritamente crescente; fora de
 *   [x₀, x_{N−1}] o resultado é NaN.
 * - logspace(a, b, n): 10^linspace(a, b, n); a e b são expoentes decimais, não frequências.
 *   A aritmética de logspace é a mesma do SISO (app.html), que foi preservado sem alteração.
 *
 * Módulo sem DOM, sem efeitos colaterais e sem dependências.
 */

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isVec = (v) => Array.isArray(v) || v instanceof Float64Array;

function num(x, nome) {
  if (!isNum(x)) throw new TypeError(`${nome} deve ser um número finito.`);
  return x;
}

function inteiro(x, nome, min) {
  if (!Number.isInteger(x)) throw new TypeError(`${nome} deve ser inteiro.`);
  if (x < min) throw new RangeError(`${nome} deve ser ≥ ${min}.`);
  return x;
}

function vetor(v, nome) {
  if (!isVec(v)) throw new TypeError(`${nome} deve ser Array ou Float64Array.`);
  for (let i = 0; i < v.length; i++) {
    if (!isNum(v[i])) throw new TypeError(`${nome}[${i}] deve ser um número finito.`);
  }
  return v;
}

function mesmoTamanho(x, y) {
  if (x.length !== y.length) {
    throw new RangeError(`x e y devem ter o mesmo comprimento (${x.length} ≠ ${y.length}).`);
  }
}

/** Aceita (x, y) ou somente (y), com espaçamento unitário. */
function pares(x, y) {
  if (y === undefined) return [null, vetor(x, 'y')];
  vetor(x, 'x');
  vetor(y, 'y');
  mesmoTamanho(x, y);
  return [x, y];
}

const passo = (xs, i) => (xs === null ? 1 : xs[i + 1] - xs[i]);

/**
 * n pontos igualmente espaçados de a até b (inclusive). Como no MATLAB, n = 1 devolve [b].
 * @param {number} a @param {number} b @param {number} n inteiro ≥ 1
 * @returns {number[]}
 */
export function linspace(a, b, n) {
  num(a, 'a');
  num(b, 'b');
  inteiro(n, 'n', 1);
  if (n === 1) return [b];
  const out = Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
  out[n - 1] = b; // extremo exato
  return out;
}

/**
 * n pontos logaritmicamente espaçados: 10^a … 10^b. Porte verbatim de logspace do SISO
 * (app.html, linha ~862); a única diferença é a validação e o caso n = 1 (devolve [10^b]).
 * @param {number} a expoente inicial @param {number} b expoente final @param {number} n inteiro ≥ 1
 * @returns {number[]}
 */
export function logspace(a, b, n) {
  num(a, 'a');
  num(b, 'b');
  inteiro(n, 'n', 1);
  if (n === 1) return [Math.pow(10, b)];
  return Array.from({ length: n }, (_, i) => Math.pow(10, a + (b - a) * i / (n - 1)));
}

/**
 * Integral pela regra do trapézio composta. trapz(y) usa Δx = 1.
 * @param {number[]|Float64Array} x @param {number[]|Float64Array} [y]
 * @returns {number} 0 para vetores com menos de 2 pontos
 */
export function trapz(x, y) {
  const [xs, ys] = pares(x, y);
  let acc = 0;
  for (let i = 0; i < ys.length - 1; i++) acc += passo(xs, i) * (ys[i] + ys[i + 1]) / 2;
  return acc;
}

/**
 * Integral acumulada pela regra do trapézio. Resultado[0] = 0 e o último elemento é trapz(x, y).
 * @param {number[]|Float64Array} x @param {number[]|Float64Array} [y]
 * @returns {number[]}
 */
export function cumtrapz(x, y) {
  const [xs, ys] = pares(x, y);
  const out = new Array(ys.length);
  if (ys.length === 0) return out;
  out[0] = 0;
  for (let i = 0; i < ys.length - 1; i++) {
    out[i + 1] = out[i] + passo(xs, i) * (ys[i] + ys[i + 1]) / 2;
  }
  return out;
}

function simpsonPair(x0,x1,x2,y0,y1,y2) {
  const h0=x1-x0,h1=x2-x1;
  return (h0+h1)/6*(y0*(2-h1/h0)+y1*((h0+h1)**2/(h0*h1))+y2*(2-h0/h1));
}

/** Composite Simpson 1/3 integration, with the Cartwright correction for even sample counts. */
export function simpson(x,y) {
  const [xs,ys]=pares(x,y),n=ys.length;
  if(n<2)return 0;
  if(xs!==null){let dir=0;for(let i=1;i<n;i++){const d=xs[i]-xs[i-1];if(d===0)throw new RangeError('x não pode ter valores repetidos.');if(dir===0)dir=Math.sign(d);else if(Math.sign(d)!==dir)throw new RangeError('x deve ser estritamente monótono.');}}
  const xat=i=>xs===null?i:xs[i];let end=n;if(n%2===0)end=n-1;let acc=0;
  for(let i=0;i+2<end;i+=2)acc+=simpsonPair(xat(i),xat(i+1),xat(i+2),ys[i],ys[i+1],ys[i+2]);
  if(n%2===0){
    if(n===2)return (xat(1)-xat(0))*(ys[0]+ys[1])/2;
    const h0=xat(n-2)-xat(n-3),h1=xat(n-1)-xat(n-2);
    const alpha=(2*h1*h1+3*h0*h1)/(6*(h0+h1)),beta=(h1*h1+3*h0*h1)/(6*h0),eta=h1*h1*h1/(6*h0*(h0+h1));
    acc+=alpha*ys[n-1]+beta*ys[n-2]-eta*ys[n-3];
  }
  return acc;
}

/** Adaptive Simpson quadrature on a finite interval; a compact EEVL routine, not QUADPACK. */
export function quad(f,a,b,options={}) {
  if(typeof f!=='function')throw new TypeError('f deve ser uma função.');num(a,'a');num(b,'b');
  if(options===null||typeof options!=='object')throw new TypeError('options deve ser objeto.');
  const epsAbs=options.epsAbs??1e-10,epsRel=options.epsRel??1e-8,maxDepth=options.maxDepth??20;
  num(epsAbs,'epsAbs');num(epsRel,'epsRel');if(epsAbs<0||epsRel<0||epsAbs+epsRel===0)throw new RangeError('Tolerâncias devem ser não negativas e não ambas zero.');
  inteiro(maxDepth,'maxDepth',0);if(maxDepth>30)throw new RangeError('maxDepth deve ser ≤ 30.');
  if(a===b)return {value:0,error:0,evaluations:0,converged:true};
  const sign=b<a?-1:1,lo=Math.min(a,b),hi=Math.max(a,b);let evaluations=0;
  const evalAt=x=>{const y=f(x);evaluations++;return num(y,`f(${x})`);};
  const fa=evalAt(lo),fb=evalAt(hi),mid=(lo+hi)/2,fm=evalAt(mid),whole=(hi-lo)*(fa+4*fm+fb)/6;
  const rec=(l,r,fl,fr,fc,estimate,tol,depth)=>{
    const c=(l+r)/2,lm=(l+c)/2,rm=(c+r)/2,flm=evalAt(lm),frm=evalAt(rm);
    const left=(c-l)*(fl+4*flm+fc)/6,right=(r-c)*(fc+4*frm+fr)/6,delta=left+right-estimate,err=Math.abs(delta)/15;
    if(err<=tol)return {value:left+right+delta/15,error:err,converged:true};
    if(depth===0)return {value:left+right+delta/15,error:err,converged:false};
    const q1=rec(l,c,fl,fc,flm,left,tol/2,depth-1),q2=rec(c,r,fc,fr,frm,right,tol/2,depth-1);
    return {value:q1.value+q2.value,error:q1.error+q2.error,converged:q1.converged&&q2.converged};
  };
  const result=rec(lo,hi,fa,fb,fm,whole,Math.max(epsAbs,epsRel*Math.abs(whole)),maxDepth);
  return {value:sign*result.value,error:result.error,evaluations,converged:result.converged};
}

/**
 * Soma acumulada: out[i] = Σ v[0..i].
 * @param {number[]|Float64Array} v @returns {number[]}
 */
export function cumsum(v) {
  vetor(v, 'v');
  const out = new Array(v.length);
  let acc = 0;
  for (let i = 0; i < v.length; i++) out[i] = (acc += v[i]);
  return out;
}

/** Soma de todos os elementos (0 para vetor vazio). @returns {number} */
export function sum(v) {
  vetor(v, 'v');
  let acc = 0;
  for (let i = 0; i < v.length; i++) acc += v[i];
  return acc;
}

/**
 * Média aritmética. Vetor vazio gera RangeError (MATLAB devolveria NaN).
 * @returns {number}
 */
export function mean(v) {
  vetor(v, 'v');
  if (v.length === 0) throw new RangeError('mean exige pelo menos 1 elemento.');
  return sum(v) / v.length;
}

/**
 * Desvio-padrão amostral: sqrt(Σ(v − média)² / (N − 1)), como std do MATLAB.
 * N = 1 devolve 0. Vetor vazio gera RangeError.
 * @returns {number}
 */
export function std(v) {
  vetor(v, 'v');
  const n = v.length;
  if (n === 0) throw new RangeError('std exige pelo menos 1 elemento.');
  if (n === 1) return 0;
  const m = mean(v);
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (v[i] - m) * (v[i] - m);
  return Math.sqrt(ss / (n - 1));
}

/** Sample median with NumPy's default linear quantile convention. */
export function median(v) { return quantile(v,0.5); }

/** Sample quantile with NumPy's default linear/type-7 convention; q may be scalar or vector. */
export function quantile(v,q) {
  vetor(v,'v');if(v.length===0)throw new RangeError('quantile exige pelo menos 1 elemento.');
  const sorted=Array.from(v).sort((a,b)=>a-b);
  const at=p=>{num(p,'q');if(p<0||p>1)throw new RangeError('q deve estar em [0,1].');const h=(sorted.length-1)*p,i=Math.floor(h),f=h-i;return sorted[i]+f*(sorted[Math.min(i+1,sorted.length-1)]-sorted[i]);};
  if(typeof q==='number')return at(q);
  if(!isVec(q))throw new TypeError('q deve ser número ou vetor.');
  return Array.from(q,at);
}

/** Percentiles on [0,100], using the NumPy default linear convention. */
export function percentile(v,p) {
  if(typeof p==='number'){num(p,'p');if(p<0||p>100)throw new RangeError('p deve estar em [0,100].');return quantile(v,p/100);}
  if(!isVec(p))throw new TypeError('p deve ser número ou vetor.');
  const q=Array.from(p,x=>{num(x,'p');if(x<0||x>100)throw new RangeError('p deve estar em [0,100].');return x/100;});
  return quantile(v,q);
}

/** Histogram counts and edges. Supports integer bin count or explicit increasing edges. */
export function histogram(v,bins=10,range) {
  vetor(v,'v');let edges;
  if(Number.isInteger(bins)){
    if(bins<1)throw new RangeError('bins deve ser inteiro positivo.');let lo,hi;
    if(range!==undefined){if(!Array.isArray(range)||range.length!==2)throw new TypeError('range deve ser [mínimo,máximo].');[lo,hi]=range;num(lo,'range[0]');num(hi,'range[1]');if(!(hi>lo))throw new RangeError('range deve ter máximo maior que mínimo.');}
    else if(v.length){lo=Infinity;hi=-Infinity;for(let i=0;i<v.length;i++){if(v[i]<lo)lo=v[i];if(v[i]>hi)hi=v[i];}if(lo===hi){lo-=0.5;hi+=0.5;}}
    else {lo=0;hi=1;}
    edges=Array.from({length:bins+1},(_,i)=>lo+(hi-lo)*i/bins);edges[bins]=hi;
  }else{
    vetor(bins,'bins');if(bins.length<2)throw new RangeError('bins explícito exige ao menos 2 bordas.');edges=Array.from(bins);
    for(let i=1;i<edges.length;i++)if(!(edges[i]>edges[i-1]))throw new RangeError('As bordas devem ser estritamente crescentes.');
  }
  const counts=new Array(edges.length-1).fill(0),last=edges[edges.length-1];
  for(const x of v){if(x<edges[0]||x>last)continue;let i;
    if(x===last)i=counts.length-1;
    else {let lo=0,hi=edges.length-1;while(hi-lo>1){const mid=(lo+hi)>>>1;if(x<edges[mid])hi=mid;else lo=mid;}i=lo;}
    counts[i]++;
  }
  return {counts,edges};
}

/**
 * Norma vetorial p-ésima. p ∈ {1, 2, Infinity}; padrão 2 (euclidiana).
 * @param {number[]|Float64Array} v @param {1|2|number} [p=2]
 * @returns {number}
 */
export function norm(v, p = 2) {
  vetor(v, 'v');
  if (p === 1) {
    let acc = 0;
    for (let i = 0; i < v.length; i++) acc += Math.abs(v[i]);
    return acc;
  }
  if (p === 2) return Math.hypot(...v);
  if (p === Infinity) {
    let mx = 0;
    for (let i = 0; i < v.length; i++) mx = Math.max(mx, Math.abs(v[i]));
    return mx;
  }
  throw new RangeError('norm: p deve ser 1, 2 ou Infinity.');
}

/**
 * Diferenças sucessivas: out[i] = v[i+1] − v[i]; comprimento N − 1 (vazio se N < 2).
 * @returns {number[]}
 */
export function diff(v) {
  vetor(v, 'v');
  const out = new Array(Math.max(v.length - 1, 0));
  for (let i = 0; i < out.length; i++) out[i] = v[i + 1] - v[i];
  return out;
}

function avalia(x, y, q) {
  const n = x.length;
  if (!(q >= x[0] && q <= x[n - 1])) return NaN; // fora do intervalo ou NaN
  // Invariante: x[lo] ≤ q ≤ x[hi]
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (x[mid] <= q) lo = mid;
    else hi = mid;
  }
  if (q === x[lo]) return y[lo];
  return y[lo] + (q - x[lo]) * (y[hi] - y[lo]) / (x[hi] - x[lo]);
}

/**
 * Interpolação linear 1-D. x deve ser estritamente crescente; fora do intervalo → NaN.
 * @param {number[]|Float64Array} x @param {number[]|Float64Array} y
 * @param {number|number[]|Float64Array} xq escalar ou vetor de consulta
 * @returns {number|number[]}
 */
export function interp1(x, y, xq) {
  vetor(x, 'x');
  vetor(y, 'y');
  mesmoTamanho(x, y);
  if (x.length < 2) throw new RangeError('interp1 exige pelo menos 2 pontos.');
  for (let i = 1; i < x.length; i++) {
    if (!(x[i] > x[i - 1])) throw new RangeError(`x deve ser estritamente crescente (falha em x[${i}]).`);
  }
  if (typeof xq === 'number') return avalia(x, y, xq);
  if (!isVec(xq)) throw new TypeError('xq deve ser um número ou um vetor.');
  const out = new Array(xq.length);
  for (let i = 0; i < xq.length; i++) {
    if (typeof xq[i] !== 'number') throw new TypeError(`xq[${i}] deve ser número.`);
    out[i] = avalia(x, y, xq[i]);
  }
  return out;
}
