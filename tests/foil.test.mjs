import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import * as THREE from 'three';
import {defaults} from '../public/model.js';
import {baseById,foilOptics,foilResponse} from '../public/materials.js';
import {surface} from '../public/render.js';
import {createProduct,disposeProduct} from '../public/scene3d.js';
globalThis.document={createElement:()=>createCanvas(1,1)};
const plane={w:200,h:300,pixels:new Uint8ClampedArray(200*300*4),mask:new Uint8ClampedArray(200*300*4)};
test('all glitter and brushed bases change at fixed surface positions with viewing angle',()=>{
  for(const base of ['brush-silver','brush-holo','white-glitter','silver-glitter','violet-glitter','rainbow-holo','stars']){
    const a=surface({...defaults,base},plane).toBuffer('image/png'),b=surface({...defaults,base,angleY:18,angleX:9},plane).toBuffer('image/png');assert.notDeepEqual(a,b,base);
  }
});
test('full white and absent backing prevent glints; glints are deterministic, not timed',()=>{
  const white=new Uint8ClampedArray(plane.mask.length);for(let i=3;i<white.length;i+=4)white[i]=255;
  const render=s=>surface({...defaults,base:'silver-glitter',...s},{...plane,mask:white}).toBuffer('image/png');assert.deepEqual(render({angleY:0}),render({angleY:22}));
  const clear=s=>surface({...defaults,backing:'none',...s},plane).toBuffer('image/png');assert.deepEqual(clear({angleY:0}),clear({angleY:22}));
  const optics=foilOptics(defaults,baseById['silver-glitter']);assert.deepEqual(foilResponse(optics,33,54),foilResponse(optics,33,54));
});
test('3D optical response is inside printed surface, below white and transmissive color ink',()=>{
  const root=createProduct(defaults,null,null),surface=root.getObjectByName('printed-surface');
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};surface.material.onBeforeCompile(shader);
  assert(shader.vertexShader.includes('cameraPosition-(modelMatrix'));assert(shader.fragmentShader.includes('uFoilStrength*(1.0-printWhite)'));assert(shader.fragmentShader.includes('foilVisibility*mix(vec3(1.0),printInk.rgb,printAlpha)'));assert.equal(shader.uniforms.uFoilKind.value,2);
  assert(root.getObjectByName('inward-foil').material.userData.foilUniforms);assert.equal(root.getObjectByName('outward-pattern').material.userData.foilUniforms,undefined);disposeProduct(root);
});
