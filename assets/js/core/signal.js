/** Small signal-processing kernels: DFT/FFT and linear difference-equation filtering. */

const isComplex=z=>z!==null&&typeof z==='object'&&typeof z.re==='number'&&typeof z.im==='number';
const c=z=>typeof z==='number'?{re:z,im:0}:{re:z.re,im:z.im};
const add=(a,b)=>({re:a.re+b.re,im:a.im+b.im});
const sub=(a,b)=>({re:a.re-b.re,im:a.im-b.im});
const mul=(a,b)=>({re:a.re*b.re-a.im*b.im,im:a.re*b.im+a.im*b.re});
const div=(a,b)=>{if(Math.abs(b.re)>=Math.abs(b.im)){if(b.re===0)throw new RangeError('Divisão por zero em lfilter.');const r=b.im/b.re,d=b.re+b.im*r;return {re:(a.re+a.im*r)/d,im:(a.im-a.re*r)/d};}const r=b.re/b.im,d=b.im+b.re*r;return {re:(a.re*r+a.im)/d,im:(a.im*r-a.re)/d};};
function vector(v,name){if(!Array.isArray(v))throw new TypeError(`${name} deve ser vetor.`);for(let i=0;i<v.length;i++){const z=v[i];if(!(typeof z==='number'&&Number.isFinite(z))&&!(isComplex(z)&&Number.isFinite(z.re)&&Number.isFinite(z.im)))throw new TypeError(`${name}[${i}] deve ser finito.`);}return v.map(c);}
const output=(z,complex)=>complex?z:z.re;

/** Discrete Fourier transform; radix-2 FFT and Bluestein for other lengths. */
export function fft(input) {
  const src=vector(input,'input'),n=src.length,out=Array.from({length:n},()=>({re:0,im:0}));
  if(n===0)return out;
  if((n&(n-1))===0){
    let j=0;for(let i=1;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j)[src[i],src[j]]=[src[j],src[i]];}
    for(let len=2;len<=n;len*=2){const angle=-2*Math.PI/len,wlen={re:Math.cos(angle),im:Math.sin(angle)};
      for(let start=0;start<n;start+=len){let w={re:1,im:0};for(let k=0;k<len/2;k++){const u=src[start+k],v=mul(src[start+k+len/2],w);src[start+k]=add(u,v);src[start+k+len/2]=sub(u,v);w=mul(w,wlen);}}
    }
    return src;
  }
  // Bluestein expresses the DFT as a convolution padded to a power of two.
  let m=1;while(m<2*n-1)m*=2;
  const a=Array.from({length:m},()=>({re:0,im:0})),b=Array.from({length:m},()=>({re:0,im:0}));
  for(let k=0;k<n;k++){
    const angle=Math.PI*((k*k)%(2*n))/n,chirp={re:Math.cos(angle),im:Math.sin(angle)};
    a[k]=mul(src[k],{re:chirp.re,im:-chirp.im});b[k]=chirp;if(k)b[m-k]=chirp;
  }
  const fa=fft(a),fb=fft(b),conv=ifft(fa.map((z,k)=>mul(z,fb[k])));
  for(let k=0;k<n;k++){
    const angle=Math.PI*((k*k)%(2*n))/n;
    out[k]=mul(conv[k],{re:Math.cos(angle),im:-Math.sin(angle)});
  }
  return out;
}

/** Inverse DFT/FFT, normalized by 1/N like NumPy and MATLAB. */
export function ifft(input) {
  const src=vector(input,'input'),n=src.length;
  if(!n)return [];
  // Conjugation turns the inverse into a forward transform.
  const conj=src.map(z=>({re:z.re,im:-z.im}));
  const out=fft(conj).map(z=>{const q=c(z);return {re:q.re/n,im:-q.im/n};});
  return out;
}

/**
 * Direct Form II transposed filter, matching scipy.signal.lfilter for 1-D data.
 * Returns {y,zf}; coefficients are normalized by a[0].
 */
export function lfilter(b,a,x,zi) {
  const B=vector(b,'b'),A=vector(a,'a'),X=vector(x,'x');
  if(!B.length||!A.length)throw new RangeError('b e a devem ter ao menos um coeficiente.');
  if(A[0].re===0&&A[0].im===0)throw new RangeError('a[0] não pode ser zero.');
  const order=Math.max(A.length,B.length)-1,an=A.map(v=>div(v,A[0])),bn=B.map(v=>div(v,A[0]));
  while(an.length<=order)an.push({re:0,im:0});while(bn.length<=order)bn.push({re:0,im:0});
  let state=zi===undefined?Array.from({length:order},()=>({re:0,im:0})):vector(zi,'zi');
  if(state.length!==order)throw new RangeError(`zi deve ter ${order} elementos.`);
  const complex=[...b,...a,...x,...(zi||[])].some(isComplex),y=[];
  for(const sample of X){
    const value=order?add(mul(bn[0],sample),state[0]):mul(bn[0],sample);y.push(value);
    for(let i=0;i<order-1;i++)state[i]=add(state[i+1],sub(mul(bn[i+1],sample),mul(an[i+1],value)));
    if(order)state[order-1]=sub(mul(bn[order],sample),mul(an[order],value));
  }
  return {y:y.map(z=>output(z,complex)),zf:state.map(z=>output(z,complex))};
}

/** MATLAB/Octave name for the same direct-form-II transposed kernel. */
export const filter=lfilter;

/* ---- fftshift / ifftshift e janelas (semântica do MATLAB) ---- */

function shiftBy(input,shiftFn){
  vector(input,'input');
  const n=input.length,s=shiftFn(n);
  const out=new Array(n);
  for(let i=0;i<n;i++){const z=input[i];out[(i+s)%n]=typeof z==='number'?z:{re:z.re,im:z.im};}
  return out;
}

/**
 * Move a componente de frequência zero para o centro: troca circularmente por
 * floor(N/2) posições, como o fftshift do MATLAB (N par: troca as metades;
 * N ímpar: o elemento 0 vai para o índice (N-1)/2). Só vetores (reais ou
 * `{re,im}`); preserva o tipo de cada elemento e não altera a entrada.
 */
export function fftshift(x){return shiftBy(x,n=>Math.floor(n/2));}

/** Inversa de `fftshift` (deslocamento por ceil(N/2)); idêntica a fftshift para N par. */
export function ifftshift(x){return shiftBy(x,n=>Math.ceil(n/2));}

function windowLength(L,name){
  if(typeof L!=='number'||!Number.isFinite(L))throw new TypeError(`${name}: L deve ser um número finito.`);
  if(!Number.isInteger(L)||L<0)throw new RangeError(`${name}: L deve ser inteiro ≥ 0.`);
}
function windowFlag(flag,name){
  if(flag===undefined)return 'symmetric';
  const f=typeof flag==='string'?flag.toLowerCase():flag;
  if(f!=='symmetric'&&f!=='periodic')throw new RangeError(`${name}: flag deve ser 'symmetric' ou 'periodic'.`);
  return f;
}
// Janela simétrica de soma de cossenos Σ a[k]·cos(2πkn/(L-1)): calcula a primeira
// metade e espelha, garantindo simetria exata (w[i] === w[L-1-i]).
function symmetricCosineWindow(L,terms){
  if(L===0)return [];
  if(L===1)return [1];
  const half=Math.ceil(L/2),w=new Array(L);
  for(let i=0;i<half;i++){
    let v=0;for(let k=0;k<terms.length;k++)v+=terms[k]*Math.cos(2*Math.PI*k*i/(L-1));
    w[i]=v;w[L-1-i]=v;
  }
  return w;
}
function cosineWindow(L,flag,terms,name){
  windowLength(L,name);
  const f=windowFlag(flag,name);
  if(L<=1)return L===0?[]:[1];
  // Periódica = simétrica de comprimento L+1 sem a última amostra (como o MATLAB).
  return f==='periodic'?symmetricCosineWindow(L+1,terms).slice(0,L):symmetricCosineWindow(L,terms);
}

/**
 * Janela de Hamming: w[n] = 0,54 − 0,46·cos(2πn/(L−1)), n = 0…L−1. `flag`:
 * 'symmetric' (padrão) ou 'periodic' (= simétrica de L+1 sem a última amostra).
 * L = 0 → []; L = 1 → [1]. L deve ser inteiro ≥ 0 (o MATLAB arredonda com aviso;
 * aqui lança RangeError).
 */
export function hamming(L,flag){return cosineWindow(L,flag,[0.54,-0.46],'hamming');}

/**
 * Janela de Hann como no MATLAB (`hann`): w[n] = 0,5·(1 − cos(2πn/(L−1))). No caso
 * simétrico as extremidades são exatamente zero (diferente de `hanning`, que exclui
 * os zeros e equivale a hann(L+2) sem as pontas). 'periodic': hann(L+1) sem o último.
 * L = 0 → []; L = 1 → [1].
 */
export function hann(L,flag){return cosineWindow(L,flag,[0.5,-0.5],'hann');}

/**
 * Janela de Blackman: w[n] = 0,42 − 0,5·cos(2πn/(L−1)) + 0,08·cos(4πn/(L−1)).
 * Calculada pela primeira metade e espelhada (simetria exata). Os valores das
 * pontas não são exatamente zero, e sim ruído de arredondamento (~ −1,4e−17),
 * como no MATLAB. L = 0 → []; L = 1 → [1].
 */
export function blackman(L,flag){return cosineWindow(L,flag,[0.42,-0.5,0.08],'blackman');}
