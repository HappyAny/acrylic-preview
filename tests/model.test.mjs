import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compositePixel,maskCoverage,imageRect,defaults,sanitizeState} from '../public/model.js';
test('full white underbase hides substrate and retains ink color',()=>{for(const base of [[0,0,0],[220,180,250],[255,255,255]])assert.deepEqual(compositePixel(base,[42,88,160],1,1),[42,88,160]);});
test('no white and no ink leave base visible',()=>assert.deepEqual(compositePixel([130,160,210],[20,80,140],0,0),[130,160,210]));
test('ink without white transmits substrate; white increases brightness',()=>{const base=[80,120,160],ink=[180,100,200];const no=compositePixel(base,ink,1,0),full=compositePixel(base,ink,1,1);no.forEach((v,i)=>assert(v<full[i]));});
test('mask modes use alpha and correct polarity, including transparent white',()=>{assert.equal(maskCoverage(255,255,255,0,'light'),0);assert.equal(maskCoverage(0,0,0,255,'alpha'),1);assert.equal(maskCoverage(0,0,0,255,'light'),0);assert.equal(maskCoverage(0,0,0,255,'dark'),1);assert.equal(maskCoverage(255,255,255,255,'dark'),0);assert(Math.abs(maskCoverage(128,128,128,128,'light')-(128/255)**2)<1e-9);});
test('contain and cover maintain image ratio and share white mask coordinates',()=>{assert.deepEqual(imageRect(200,100,100,150,defaults),[0,50,100,50]);assert.deepEqual(imageRect(200,100,100,150,{...defaults,fit:'cover'}),[-100,0,300,150]);});
test('untrusted project values are bounded; NaN and unknown keys rejected',()=>{const s=sanitizeState({width:0,height:Infinity,edge:'<script>',scale:999,whiteOpacity:-40,angleY:NaN,unknown:true});assert.equal(s.width,30);assert.equal(s.height,150);assert.equal(s.edge,defaults.edge);assert.equal(s.scale,200);assert.equal(s.whiteOpacity,0);assert.equal(s.angleY,0);assert.equal(s.unknown,undefined);});
