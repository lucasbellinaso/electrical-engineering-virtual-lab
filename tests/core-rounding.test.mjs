import test from 'node:test';
import assert from 'node:assert/strict';
import {round,floor,ceil,fix} from '../assets/js/core/rounding.js';
test('Octave rounding directions and ties',()=>{
 assert.deepEqual(round([-2.7,-2.5,-1.5,1.5,2.5,2.7]),[-3,-3,-2,2,3,3]);
 assert.deepEqual(floor([-2.7,2.7]),[-3,2]);
 assert.deepEqual(ceil([-2.7,2.7]),[-2,3]);
 assert.deepEqual(fix([-2.7,2.7]),[-2,2]);
});
test('complex values and arrays are processed componentwise',()=>{
 assert.deepEqual(round([[{re:-1.5,im:2.5}]]),[[{re:-2,im:3}]]);
 assert.deepEqual(floor(new Float64Array([1.9,-1.1])),[1,-2]);
 assert.equal(round(Infinity),Infinity);assert.ok(Number.isNaN(round(NaN)));
 assert.throws(()=>fix('1'),TypeError);
});
