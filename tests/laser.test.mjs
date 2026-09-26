import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {defaults,sanitizeState} from '../public/model.js';
import {filmOverlay,laserSample} from '../public/decoration.js';
import {createProduct,disposeProduct} from '../public/scene3d.js';
globalThis.document={createElement:()=>createCanvas(1,1)};
test('laser patterns change color with viewing direction; clear film has no spectral structure',()=>{
  const s={...defaults,film:'gloss',filmPattern:'stars',filmPatternCoverage:'translucent'};assert.notDeepEqual(laserSample(s,.3,.4,0,0),laserSample(s,.3,.4,.4,0));
  const results=[];
  for(const filmStructure of ['pillars','cross','facets','rings','omni']){const c=filmOverlay({...s,filmStructure},100,150);const pixels=c.getContext('2d').getImageData(0,0,100,150).data;assert(pixels.some((v,i)=>i%4===3&&v>0));assert(pixels.every((v,i)=>i%4!==3||v<128));results.push(c.toBuffer('image/png'));}
  for(let i=1;i<results.length;i++)assert.notDeepEqual(results[0],results[i]);
});
test('local laser uses custom alpha as an optical mask instead of printing its RGB',()=>{
  const a=createCanvas(20,20),b=createCanvas(20,20);for(const [c,color] of [[a,'red'],[b,'blue']]){const x=c.getContext('2d');x.fillStyle=color;x.fillRect(5,5,10,10);c.naturalWidth=c.naturalHeight=20;}
  const s={...defaults,film:'gloss',filmPattern:'custom',filmMaskMode:'alpha',filmPatternFinish:'laser'};
  assert.deepEqual(filmOverlay(s,40,40,a).toBuffer('image/png'),filmOverlay(s,40,40,b).toBuffer('image/png'));
  assert.notDeepEqual(filmOverlay({...s,filmPatternFinish:'ink'},40,40,a).toBuffer('image/png'),filmOverlay({...s,filmPatternFinish:'ink'},40,40,b).toBuffer('image/png'));
});
test('3D laser is a view-dependent shader on thin surfaces, not opaque raised shapes',()=>{
  const root=createProduct({...defaults,film:'gloss',filmPattern:'stars'},null,null);
  assert.equal(root.getObjectByName('top-film').material.isShaderMaterial,undefined);assert.equal(root.getObjectByName('top-film').material.iridescence,0);
  for(const name of ['film-pattern']){const obj=root.getObjectByName(name);assert.equal(obj.geometry.type,'PlaneGeometry');assert(obj.material.isShaderMaterial);assert(obj.material.vertexShader.includes('cameraPosition'));assert.equal(obj.material.depthWrite,false);assert.equal(obj.material.transparent,true);}
  disposeProduct(root);assert.equal(sanitizeState({filmPitch:0,filmDirection:900}).filmPitch,2);assert.equal(sanitizeState({filmDirection:900}).filmDirection,180);
});

test('unpatterned pixels match neutral clear coating exactly, including legacy film import',()=>{
  const mask=createCanvas(20,20),x=mask.getContext('2d');x.fillRect(5,5,10,10);mask.naturalWidth=mask.naturalHeight=20;
  const s={...defaults,film:'gloss',filmPattern:'custom',filmMaskMode:'alpha'},data=c=>c.getContext('2d').getImageData(0,0,20,20).data;
  const clear=data(filmOverlay({...s,filmPattern:'none'},20,20)),laser=data(filmOverlay(s,20,20,mask));
  let changed=false;for(let y=0;y<20;y++)for(let x=0;x<20;x++){const i=(y*20+x)*4;if(x<5||x>=15||y<5||y>=15)assert.deepEqual(laser.slice(i,i+4),clear.slice(i,i+4));else if(laser[i]!==clear[i])changed=true;}assert(changed);
  assert.equal(sanitizeState({film:'holo',filmPattern:'stars'}).film,'gloss');
  assert.deepEqual(filmOverlay({...defaults,film:'gloss'},20,20).toBuffer('image/png'),filmOverlay({...defaults,film:'gloss',filmStructure:'rings',filmDirection:70},20,20).toBuffer('image/png'));
});
test('opaque patterns block art independently of optical strength, retaining alpha holes',()=>{
  const image=createCanvas(30,30),ctx=image.getContext('2d');ctx.fillStyle='#e73878';ctx.fillRect(8,8,14,14);image.naturalWidth=image.naturalHeight=30;
  for(const filmPatternFinish of ['laser','ink'])for(const filmOpacity of [0,40,100]){
    const s={...defaults,film:'gloss',filmPattern:'custom',filmMaskMode:'alpha',filmPatternCoverage:'opaque',filmPatternFinish,filmOpacity,filmStrength:0};
    const result=filmOverlay(s,30,30,image).getContext('2d');assert.equal(result.getImageData(15,15,1,1).data[3],255);assert.equal(result.getImageData(0,0,1,1).data[3],0);
    const product=createProduct(s,null,null,{film:image}),mat=product.getObjectByName('film-pattern').material;
    if(filmPatternFinish==='laser')assert.equal(mat.uniforms.uOpaque.value,1);else assert.equal(mat.map.image.getContext('2d').getImageData(Math.floor(mat.map.image.width/2),Math.floor(mat.map.image.height/2),1,1).data[3],255);
    disposeProduct(product);
  }
  assert.equal(sanitizeState({filmPatternCoverage:'opaque',filmStructure:'omni'}).filmPatternCoverage,'opaque');assert.equal(sanitizeState({}).filmPatternCoverage,'opaque');
});
test('omnidirectional pattern retains color response through eight viewing directions',()=>{
  const s={...defaults,filmStructure:'omni',filmPatternCoverage:'opaque',filmOpacity:100};const colors=[];
  for(let i=0;i<8;i++){const angle=i*Math.PI/4,p=laserSample(s,.37,.46,.4*Math.cos(angle),.4*Math.sin(angle));assert.equal(p[3],1);assert(p.slice(0,3).every(v=>Number.isFinite(v)&&v>=0&&v<=1));colors.push(p.slice(0,3).map(v=>Math.round(v*255)).join(','));}
  assert.equal(new Set(colors).size,8);assert.notDeepEqual(laserSample(s,.37,.46,0,0),laserSample({...s,filmStructure:'pillars'},.37,.46,0,0));
});
