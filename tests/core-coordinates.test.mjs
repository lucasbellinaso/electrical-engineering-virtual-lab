import test from 'node:test';
import assert from 'node:assert/strict';
import {cart2pol,pol2cart,cart2sph,sph2cart,deg2rad,rad2deg} from '../assets/js/core/coordinates.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12, `${a} != ${b}`);
test('polar coordinates follow Octave angle and radius ordering',()=>{
 const [theta,r,z]=cart2pol(-3,4,7);near(theta,Math.atan2(4,-3));near(r,5);assert.equal(z,7);
 const [x,y,height]=pol2cart(theta,r,z);near(x,-3);near(y,4);assert.equal(height,7);
 assert.deepEqual(cart2pol(0,0),[0,0]);
});
test('spherical angles use elevation from xy plane',()=>{
 const [az,el,r]=cart2sph(0,3,4);near(az,Math.PI/2);near(el,Math.atan2(4,3));near(r,5);
 const xyz=sph2cart(az,el,r);xyz.forEach((v,i)=>near(v,[0,3,4][i]));
});
test('arrays, matrices and scalar broadcasting preserve shape',()=>{
 const [angles,radii]=cart2pol([[3,4],[-3,4]]);assert.deepEqual(radii,[5,5]);near(angles[0],Math.atan2(4,3));
 const [x,y,z]=pol2cart(0,2,[3,4]);assert.deepEqual(x,[2,2]);assert.deepEqual(y,[0,0]);assert.deepEqual(z,[3,4]);
 assert.deepEqual(deg2rad([[0,180],[-90,360]]),[[0,Math.PI],[-Math.PI/2,2*Math.PI]]);
 near(rad2deg(Math.PI/2),90);near(sph2cart([[0,0,2]])[0][0],2);
 assert.throws(()=>cart2pol([1,2],[1]),RangeError);
 assert.throws(()=>sph2cart([[1,2]]),TypeError);
});
