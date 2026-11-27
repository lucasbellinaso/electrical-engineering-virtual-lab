/** Seeded, reproducible pseudo-random values for simulations. */

/** Mulberry32 generator returning uniform values in [0,1). */
export function mulberry32(seed) {
  if(!Number.isInteger(seed))throw new TypeError('seed deve ser inteiro.');
  if(seed<0||seed>0xffffffff)throw new RangeError('seed deve estar entre 0 e 2^32−1.');
  let state=seed>>>0;
  return ()=>{state=(state+0x6d2b79f5)>>>0;let t=Math.imul(state^(state>>>15),1|state);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};
}

/** Create a seeded uniform/normal sampler; normal uses Box–Muller with cached pairs. */
export function createRandom(seed) {
  const uniform=mulberry32(seed);let spare=null;
  const normal=(mean=0,std=1)=>{
    if(typeof mean!=='number'||!Number.isFinite(mean)||typeof std!=='number'||!Number.isFinite(std))throw new TypeError('mean e std devem ser finitos.');
    if(std<0)throw new RangeError('std deve ser não negativo.');
    if(std===0)return mean;
    if(spare===null){const u=Math.max(uniform(),Number.MIN_VALUE),v=uniform(),r=Math.sqrt(-2*Math.log(u)),a=2*Math.PI*v;spare=r*Math.sin(a);return mean+std*r*Math.cos(a);}
    const z=spare;spare=null;return mean+std*z;
  };
  return Object.freeze({uniform,normal});
}
