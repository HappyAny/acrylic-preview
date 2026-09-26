import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {defaults} from '../public/model.js';
import {decorationCanvas,filmPatternTemplate} from '../public/decoration.js';
globalThis.document={createElement:()=>createCanvas(1,1)};
test('white film mask uses luminance times alpha: black and transparent white leave no pattern',()=>{
  const img=createCanvas(40,40),x=img.getContext('2d');img.naturalWidth=img.naturalHeight=40;x.fillStyle='black';x.fillRect(0,0,40,40);x.fillStyle='white';x.fillRect(10,0,10,40);x.fillStyle='#808080';x.fillRect(20,0,10,40);x.clearRect(30,0,10,40);
  const c=decorationCanvas({...defaults,width:100,height:100,film:'gloss',filmPattern:'custom',filmPatternCoverage:'opaque'},'film',40,40,img),p=c.getContext('2d');
  assert.equal(p.getImageData(5,20,1,1).data[3],0);assert.equal(p.getImageData(15,20,1,1).data[3],255);assert.equal(p.getImageData(25,20,1,1).data[3],128);assert.equal(p.getImageData(35,20,1,1).data[3],0);
});
test('downloaded film template matches product aspect, is opaque grayscale, and round-trips pattern coverage',()=>{
  const s={...defaults,width:100,height:150,film:'gloss',filmPattern:'stars',filmOpacity:25},template=filmPatternTemplate(s,null,180);assert.equal(template.width,120);assert.equal(template.height,180);
  template.naturalWidth=120;template.naturalHeight=180;
  const source=decorationCanvas({...s,filmOpacity:100},'film',120,180),roundtrip=decorationCanvas({...s,filmPattern:'custom',filmOpacity:100},'film',120,180,template);
  const data=c=>c.getContext('2d').getImageData(0,0,120,180).data,a=data(source),b=data(roundtrip),t=data(template);
  for(let i=0;i<a.length;i+=4){assert.equal(t[i],t[i+1]);assert.equal(t[i],t[i+2]);assert.equal(t[i+3],255);assert(Math.abs(a[i+3]-b[i+3])<=1);}
});
test('blank film template is black and has no labels or unintended pattern',()=>{
  const c=filmPatternTemplate(defaults,null,60),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;assert(data.every((v,i)=>v===(i%4===3?255:0)));
});
