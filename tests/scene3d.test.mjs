import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {readFile} from 'node:fs/promises';
import {defaults,sanitizeState} from '../public/model.js';
import {edgeMaterials,baseMaterials,lightingPresets} from '../public/materials.js';
import {createProduct,disposeProduct,grainData,injectPrintShader,frameGeometry} from '../public/scene3d.js';
import {cameraDistance,validCamera} from '../public/viewer3d.js';
globalThis.document={createElement:()=>createCanvas(1,1)};
const art=await loadImage(await readFile(new URL('../public/demo.svg',import.meta.url)));Object.defineProperties(art,{naturalWidth:{value:art.width},naturalHeight:{value:art.height}});
test('reference catalogue has all 17 edge finishes and 6 bases, 2 explicitly tentative',()=>{
  assert.equal(edgeMaterials.filter(m=>!m.legacy&&m.id!=='none').length,17);assert.equal(baseMaterials.filter(m=>!m.legacy).length,6);assert.equal(baseMaterials.filter(m=>m.tentative).length,2);
  assert.equal(new Set(edgeMaterials.map(m=>m.id)).size,edgeMaterials.length);
  for(const m of [...edgeMaterials,...baseMaterials]){assert(m.roughness>=0&&m.roughness<=1);assert(m.metalness>=0&&m.metalness<=1);}
});
test('all shop edge geometries build with finite vertices and preserve real millimetre thickness',()=>{
  for(const edge of edgeMaterials){const p=createProduct({...defaults,edge:edge.id,thickness:5},art,null);const glass=p.getObjectByName('acrylic-volume');assert.deepEqual(glass.geometry.parameters,{width:.1,height:.15,depth:.005,widthSegments:1,heightSegments:1,depthSegments:1});const frame=p.getObjectByName('edge-wrap');assert.equal(!!frame,edge.id!=='none');if(frame){assert(frame.geometry.attributes.position.array.every(Number.isFinite));assert.equal(frame.material.userData.definition,edge.id);}disposeProduct(p);}
});
test('frame is a real ring: centre ray is unobstructed and edge ray hits',()=>{
  const frame=new THREE.Mesh(frameGeometry(.1,.15,.003,.0015),new THREE.MeshBasicMaterial());frame.updateMatrixWorld();const r=new THREE.Raycaster(new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1));assert.equal(r.intersectObject(frame).length,0);r.ray.origin.x=.0495;assert(r.intersectObject(frame).length>0);frame.geometry.dispose();frame.material.dispose();
});
test('all bases preserve shader mask uniforms and independent rear face',()=>{
  for(const base of baseMaterials){const p=createProduct({...defaults,base:base.id,whiteOpacity:61},art,null);const surface=p.getObjectByName('printed-surface'),shader={uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};surface.material.onBeforeCompile(shader);assert.equal(shader.uniforms.uInkStrength.value,1);assert(shader.uniforms.uWhiteLayer.value.isTexture);assert(shader.fragmentShader.includes('metalnessFactor *= 1.0 - printWhite'));assert(shader.fragmentShader.includes('material.iridescence *= 1.0 - printWhite'));assert.equal(p.getObjectByName('backing').visible,true);assert.equal(surface.material.transparent,false);assert.equal(shader.uniforms.uBottomPattern,undefined);disposeProduct(p);}
});
test('exploded geometry is separated in 3D in manufacturing layer order',()=>{
  const p=createProduct({...defaults,view:'layers'},art,null),names=['backing','exploded-white','exploded-color','acrylic-volume'],positions=names.map(n=>p.getObjectByName(n).position.z);for(let i=1;i<positions.length;i++)assert(positions[i]>positions[i-1]);assert.equal(p.getObjectByName('printed-surface').visible,false);disposeProduct(p);
});
test('surface grains are deterministic and brushed normals are directional',()=>{
  const a=grainData('brushed',32),b=grainData('brushed',32);assert.deepEqual(a.normal,b.normal);let dx=0,dy=0;for(let i=0;i<a.normal.length;i+=4){dx+=Math.abs(a.normal[i]-128);dy+=Math.abs(a.normal[i+1]-128);}assert(dx>dy*5);
});
test('PBR injection retains stock lighting/tone mapping and all include targets exist',()=>{
  const shader=injectPrintShader({vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader});
  for(const term of ['vPrintUv = uv','varying vec2 vPrintUv'])assert(shader.vertexShader.includes(term));
  for(const term of ['float printWhite','roughnessFactor = mix','metalnessFactor *=','normal = normalize(mix','material.iridescence *=','material.anisotropy *=','#include <tonemapping_fragment>','#include <lights_fragment_begin>'])assert(shader.fragmentShader.includes(term),term);
});
test('camera fit handles landscape and portrait; invalid imported camera rejected',()=>{
  assert(cameraDistance(.5,.03,1)>cameraDistance(.1,.1,1));assert(cameraDistance(.1,.2,.3)>cameraDistance(.1,.2,2));assert(validCamera({position:[0,0,.4],target:[0,0,0]}));assert(!validCamera({position:[0,0,0],target:[0,0,0]}));assert(!validCamera({position:[Infinity,0,1],target:[0,0,0]}));
});
test('lighting presets differ and old project choices stay supported',()=>{
  assert(lightingPresets.raking.fillLight<lightingPresets.studio.fillLight);assert(lightingPresets.raking.lightAzimuth!==lightingPresets.studio.lightAzimuth);
  const s=sanitizeState({edge:'rose',base:'stars',keyLight:500,exposure:0,lightAzimuth:900});assert.equal(s.edge,'rose');assert.equal(s.base,'stars');assert.equal(s.keyLight,150);assert.equal(s.exposure,40);assert.equal(s.lightAzimuth,180);
});



test('opaque cardboard has distinct inward foil and outward art; optional backing is absent',()=>{
  const root=createProduct({...defaults,backingThickness:2,bottomPattern:'stars'},art,null);
  const core=root.getObjectByName('cardboard-core'),foil=root.getObjectByName('inward-foil'),rear=root.getObjectByName('outward-pattern');
  assert.equal(core.geometry.parameters.depth,.002);assert.equal(core.material.transparent,false);assert.equal(core.material.opacity,1);
  assert(foil.position.z>core.position.z&&core.position.z>rear.position.z);assert.equal(rear.rotation.y,Math.PI);assert.equal(rear.material.metalness,0);assert.equal(rear.material.transparent,false);
  const data=rear.material.map.image.getContext('2d').getImageData(0,0,10,10).data;assert(data.every((v,i)=>i%4!==3||v===255));
  disposeProduct(root);
  const none=createProduct({...defaults,backing:'none',bottomPattern:'stars'},art,null);
  assert.equal(none.getObjectByName('cardboard-core'),undefined);assert.equal(none.getObjectByName('inward-foil'),undefined);assert.equal(none.getObjectByName('outward-pattern'),undefined);
  assert.equal(none.getObjectByName('printed-surface').material.transparent,true);assert(none.getObjectByName('rear-white-ink'));disposeProduct(none);
});
test('legacy clear base migrates to no cardboard; backing state and thickness are bounded',()=>{
  assert.equal(sanitizeState({base:'clear'}).backing,'none');assert.equal(sanitizeState({base:'silver'}).backing,'cardboard');assert.equal(sanitizeState({backingThickness:100}).backingThickness,3);assert.equal(sanitizeState({backing:'none',view:'back'}).view,'back');
});
