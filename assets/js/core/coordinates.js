/** Coordinate conversions using GNU Octave angle and output conventions. */
const isArray = value => Array.isArray(value) || value instanceof Float64Array;

function elementwise(args, fn) {
  const array = args.find(isArray);
  if (!array) {
    if (args.some(value => typeof value !== 'number')) throw new TypeError('Coordinates must be real numbers or arrays');
    return fn(...args);
  }
  const length = array.length;
  if (args.some(value => isArray(value) && value.length !== length)) throw new RangeError('Coordinate array shapes must match');
  return Array.from({length}, (_, i) => elementwise(args.map(value => isArray(value) ? value[i] : value), fn));
}
function coordinates(args, min, max) {
  if (args.length === 1) {
    const rows = args[0];
    if (!Array.isArray(rows) || !rows.length || !rows.every(row => isArray(row) && row.length >= min && row.length <= max && row.length === rows[0].length)) throw new TypeError('Expected a coordinate matrix with one point per row');
    return Array.from({length: rows[0].length}, (_, col) => rows.map(row => row[col]));
  }
  if (args.length < min || args.length > max) throw new TypeError('Incorrect number of coordinate arguments');
  return args;
}
/** Returns [theta, radius] or [theta, radius, z]; theta is in radians. */
export function cart2pol(...input) {
  const a=coordinates(input,2,3), x=a[0], y=a[1];
  const out=[elementwise(a,(u,v)=>Math.atan2(v,u)), elementwise(a,(u,v)=>Math.hypot(u,v))];
  if(a.length===3) out.push(elementwise(a,(_x,_y,z)=>z));
  return out;
}
/** Returns [x, y] or [x, y, z]; theta is in radians. */
export function pol2cart(...input) {
  const a=coordinates(input,2,3), t=a[0], r=a[1];
  const out=[elementwise(a,(angle,radius)=>radius*Math.cos(angle)),elementwise(a,(angle,radius)=>radius*Math.sin(angle))];
  if(a.length===3) out.push(elementwise(a,(_t,_r,z)=>z));
  return out;
}
/** Returns [azimuth, elevation, radius], angles in radians. */
export function cart2sph(...input) {
  const [x,y,z]=coordinates(input,3,3);
  return [elementwise([x,y,z],(a,b,_c)=>Math.atan2(b,a)),elementwise([x,y,z],(a,b,c)=>Math.atan2(c,Math.hypot(a,b))),elementwise([x,y,z],(a,b,c)=>Math.hypot(a,b,c))];
}
/** Returns [x, y, z] from azimuth, elevation and radius. */
export function sph2cart(...input) {
  const [t,p,r]=coordinates(input,3,3);
  return [elementwise([t,p,r],(a,e,v)=>v*Math.cos(e)*Math.cos(a)),elementwise([t,p,r],(a,e,v)=>v*Math.cos(e)*Math.sin(a)),elementwise([t,p,r],(_a,e,v)=>v*Math.sin(e))];
}
export function deg2rad(degrees) { return elementwise([degrees],x=>x*(Math.PI/180)); }
export function rad2deg(radians) { return elementwise([radians],x=>x*(180/Math.PI)); }
