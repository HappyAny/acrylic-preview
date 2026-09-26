import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {defaults,sanitizeState} from '../public/model.js';
import {drawScene} from '../public/render.js';
import {decorationCanvas,filmOverlay,patternNames} from '../public/decoration.js';
import {createProduct,disposeProduct} from '../public/scene3d.js';
import {studioRadiance} from '../public/lighting.js';
globalThis.document={createElement:()=>createCanvas(1,1)};
const fixture=createCanvas(20,20),fc=fixture.getContext('2d');fc.fillStyle='#886699';fc.fillRect(0,0,20,20);const art=await loadImage(fixture.toBuffer('image/png'));Object.defineProperties(art,{naturalWidth:{value:20},naturalHeight:{value:20}});
function render(s){const c=createCanvas(400,400);drawScene(c,{...defaults,width:100,height:100,...s},art,null);return c.getContext('2d').getImageData(0,0,400,400).data;}
test('rear pattern never reaches front, with or without white; top film remains visible',()=>{
  assert.deepEqual(render({whiteMode:'full',bottomPattern:'stars'}),render({whiteMode:'full',bottomPattern:'none'}));
  assert.deepEqual(render({whiteMode:'none',bottomPattern:'stars'}),render({whiteMode:'none',bottomPattern:'none'}));
  assert.notDeepEqual(render({view:'back',bottomPattern:'stars',bottomColor:'gold'}),render({view:'back',bottomPattern:'none'}));
  assert.deepEqual(render({view:'back',whiteMode:'full',film:'holo',filmPattern:'hearts'}),render({view:'back',whiteMode:'none',film:'none'}));
  assert.deepEqual(render({backing:'none',bottomPattern:'stars',base:'silver'}),render({backing:'none',bottomPattern:'none',base:'brush-holo'}));
  assert.notDeepEqual(render({whiteMode:'full',film:'gloss',filmPattern:'hearts'}),render({whiteMode:'full',film:'gloss',filmPattern:'none'}));
});
test('all procedural patterns draw, custom transparent image is contained, film disabled is empty',()=>{
  for(const pattern of Object.keys(patternNames).filter(v=>!['none','custom'].includes(v))){const c=decorationCanvas({...defaults,bottomPattern:pattern},'bottom',120,180);assert(c.getContext('2d').getImageData(0,0,120,180).data.some((v,i)=>i%4===3&&v>0));}
  const blank=filmOverlay({...defaults,film:'none',filmPattern:'hearts'},50,50);assert(blank.getContext('2d').getImageData(0,0,50,50).data.every(v=>v===0));
  const custom=decorationCanvas({...defaults,bottomPattern:'custom',bottomOpacity:100},'bottom',40,80,art);assert.equal(custom.getContext('2d').getImageData(0,0,1,1).data[3],0);assert.equal(custom.getContext('2d').getImageData(20,40,1,1).data[3],255);
});
test('film and pattern are distinct top surfaces, exploded above acrylic',()=>{
  for(const view of ['finished','layers']){const root=createProduct({...defaults,view,film:'holo',filmPattern:'stars',bottomPattern:'diamonds'},art,null);const glass=root.getObjectByName('acrylic-volume'),film=root.getObjectByName('top-film'),deco=root.getObjectByName('film-pattern');assert(film.position.z>glass.position.z);assert(deco.position.z>film.position.z);assert.equal(deco.material.depthWrite,false);disposeProduct(root);}
});
test('default mode is flat; pattern size/opacity sanitized and no floor is needed for environment lighting',()=>{
  assert.equal(defaults.previewMode,'flat');const s=sanitizeState({bottomSize:0,filmOpacity:999,film:'bad'});assert.equal(s.bottomSize,3);assert.equal(s.filmOpacity,100);assert.equal(s.film,'none');
  const front=studioRadiance([0,0,1],defaults)[0],back=studioRadiance([0,0,-1],defaults)[0];assert(front>back);assert(back>.4);assert(front/back<5);
});
