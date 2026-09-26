import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas,loadImage,GlobalFonts} from '@napi-rs/canvas';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {defaults} from '../public/model.js';
globalThis.document={createElement:()=>createCanvas(1,1)};
if(process.platform==='win32'){GlobalFonts.registerFromPath('C:/Windows/Fonts/msyh.ttc','sans-serif');GlobalFonts.registerFromPath('C:/Windows/Fonts/arial.ttf','Arial');}
const {drawScene,planes}=await import('../public/render.js');
const demo=await loadImage(await readFile(new URL('../public/demo.svg',import.meta.url)));
Object.defineProperties(demo,{naturalWidth:{value:demo.width},naturalHeight:{value:demo.height}});
const fixture=async(color,name)=>{const c=createCanvas(10,10),ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,10,10);const img=await loadImage(c.toBuffer('image/png'));Object.defineProperties(img,{naturalWidth:{value:10},naturalHeight:{value:10}});return img;};
test('actual renderer white mask polarity and opacity',async()=>{const black=await fixture('#000'),p=planes({...defaults,whiteMode:'upload',maskMode:'dark',whiteOpacity:50,width:100,height:100},black,black,10);assert.equal(p.mask[3],128);const inverse=planes({...defaults,whiteMode:'upload',maskMode:'light',width:100,height:100},black,black,10);assert.equal(inverse.mask[3],0);});
test('actual renderer full white hides base, zero white reveals material',async()=>{const art=await fixture('#b867aa');const render=(base,whiteMode)=>{const c=createCanvas(300,300);drawScene(c,{...defaults,width:100,height:100,base,whiteMode,light:0,inkOpacity:100,edge:'none'},art,null);return [...c.getContext('2d').getImageData(150,150,1,1).data];};assert.deepEqual(render('holo','full'),render('silver','full'));assert.notDeepEqual(render('holo','none'),render('silver','none'));assert.deepEqual(render('holo','full').slice(0,3),[184,103,170]);});
test('demo, all materials and all layer views render without errors',async()=>{await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});const c=createCanvas(1080,1080);for(const base of ['holo','silver','stars','pearl','clear'])for(const view of ['finished','color','white','layers']){drawScene(c,{...defaults,base,view},demo,null);const data=c.getContext('2d').getImageData(0,0,1080,1080).data;assert(data.some((v,i)=>i%4!==3&&v<220));}drawScene(c,defaults,demo,null,{caption:true});await writeFile(new URL('../artifacts/demo-preview.png',import.meta.url),c.toBuffer('image/png'));});
test('portrait, landscape, extreme aspect ratios and comparison render',()=>{const c=createCanvas(700,700);for(const [width,height]of[[30,500],[500,30],[148,210],[200,100]])drawScene(c,{...defaults,width,height,angleX:20,angleY:-25},demo,null,{caption:true,comparison:{state:{...defaults,base:'clear'},art:demo,mask:null}});});
