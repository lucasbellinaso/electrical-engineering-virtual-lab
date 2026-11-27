/** Small signal-processing kernels: DFT/FFT and linear difference-equation filtering. */

const isComplex=z=>z!==null&&typeof z==='object'&&typeof z.re==='number'&&typeof z.im==='number';
const c=z=>typeof z==='number'?{re:z,im:0}:{re:z.re,im:z.im};
const add=(a,b)=>({re:a.re+b.re,im:a.im+b.im});
const sub=(a,b)=>({re:a.re-b.re,im:a.im-b.im});
const mul=(a,b)=>({re:a.re*b.re-a.im*b.im,im:a.re*b.im+a.im*b.re});
const div=(a,b)=>{if(Math.abs(b.re)>=Math.abs(b.im)){if(b.re===0)throw new RangeError('Divisão por zero em lfilter.');const r=b.im/b.re,d=b.re+b.im*r;return {re:(a.re+a.im*r)/d,im:(a.im-a.re*r)/d};}const r=b.re/b.im,d=b.im+b.re*r;return {re:(a.re*r+a.im)/d,im:(a.im*r-a.re)/d};};
function vector(v,name){if(!Array.isArray(v))throw new TypeError(`${name} deve ser vetor.`);for(let i=0;i<v.length;i++){const z=v[i];if(!(typeof z==='number'&&Number.isFinite(z))&&!(isComplex(z)&&Number.isFinite(z.re)&&Number.isFinite(z.im)))throw new TypeError(`${name}[${i}] deve ser finito.`);}return v.map(c);}
const output=(z,complex)=>complex?z:z.re;

/** Discrete Fourier transform; radix-2 FFT, with a direct DFT fallback for other lengths. */
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
  for(let k=0;k<n;k++){let re=0,im=0;for(let t=0;t<n;t++){const angle=-2*Math.PI*k*t/n,co=Math.cos(angle),si=Math.sin(angle);re+=src[t].re*co-src[t].im*si;im+=src[t].re*si+src[t].im*co;}out[k]={re,im};}
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
