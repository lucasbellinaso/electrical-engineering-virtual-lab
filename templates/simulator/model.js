/** Ideal RC step response. SI internally; UI supplies microfarads/milliseconds. */
export const defaults = Object.freeze({voltage:5, resistance:1000, capacitance:100, initialVoltage:0, duration:500});
export const limits = Object.freeze({voltage:[-1000,1000],resistance:[1,1e7],capacitance:[0.001,1e6],initialVoltage:[-1000,1000],duration:[0.001,1e7]});
export function validate(p) {
  for (const [key,[min,max]] of Object.entries(limits)) if (typeof p[key] !== 'number' || !Number.isFinite(p[key]) || p[key] < min || p[key] > max) throw new RangeError(`Invalid ${key}`);
  const tau = p.resistance * p.capacitance * 1e-6;
  if (p.duration * 1e-3 > tau * 100 * (1 + 1e-12)) throw new RangeError('Duration exceeds 100 time constants');
  return p;
}
export function rk4(value, step, derivative) {
  const k1=derivative(value), k2=derivative(value+step*k1/2), k3=derivative(value+step*k2/2), k4=derivative(value+step*k3);
  return value + step*(k1+2*k2+2*k3+k4)/6;
}
export function simulate(parameters = defaults) {
  const p=validate(parameters), tau=p.resistance*p.capacitance*1e-6, duration=p.duration*1e-3;
  const steps=Math.max(600,Math.ceil(duration/(tau/50))), h=duration/steps;
  const samples=[]; let v=p.initialVoltage, maxError=0;
  for (let i=0;i<=steps;i++) {
    const time=i*h, exact=p.voltage+(p.initialVoltage-p.voltage)*Math.exp(-time/tau);
    samples.push({time,voltage:v,exact}); maxError=Math.max(maxError,Math.abs(v-exact));
    if (i<steps) v=rk4(v,h,x => (p.voltage-x)/tau);
  }
  return {parameters:{...p},samples,tau,step:h,maxError};
}
