import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {createCanvas,Image} from '@napi-rs/canvas';
test('app initializes, controls update, compare freezes, project saves and restores',async()=>{
  const {window,document}=parseHTML(await readFile(new URL('../public/index.html',import.meta.url),'utf8'));
  const demo=await readFile(new URL('../public/demo.svg',import.meta.url));
  const originalCreate=document.createElement.bind(document),downloads=[];
  document.createElement=name=>name==='canvas'?createCanvas(1,1):originalCreate(name);
  for(const id of ['preview','flatPreview']){const preview=createCanvas(1080,1080),el=document.getElementById(id);el.getContext=(...args)=>preview.getContext(...args);el.setPointerCapture=()=>{};}
  // Linkedom does not implement the browser select.value setter.
  document.querySelectorAll('select').forEach(select=>{let value=select.querySelector('[selected]')?.getAttribute('value')||select.querySelector('option').getAttribute('value');Object.defineProperty(select,'value',{get:()=>value,set:v=>value=String(v)});});
  globalThis.document=document;globalThis.window=window;globalThis.requestAnimationFrame=fn=>setTimeout(fn,0);
  globalThis.Image=class extends Image{get naturalWidth(){return this.width;}get naturalHeight(){return this.height;}set onload(fn){super.onload=()=>setTimeout(fn,0);}set src(v){super.src=v==='/demo.svg'?demo:v;}get src(){return super.src;}};
  const originalURL=URL.createObjectURL;URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:local-test';};
  const wait=()=>new Promise(resolve=>setTimeout(resolve,120));
  try{
    await import('../public/app.js');await wait();
    const byId=id=>document.getElementById(id),click=selector=>document.querySelector(selector).click();
    assert.equal(byId('colorName').textContent,'月光花园 · 示例画稿');assert.equal(document.querySelector('output[for="whiteOpacity"]').textContent,'100%');
    click('[data-base="stars"]');assert(byId('summary').textContent.includes('星星闪'));
    click('[data-white="upload"]');assert.equal(byId('maskControls').hidden,false);assert(byId('whiteHelp').textContent.includes('尚未选择'));
    click('[data-size="120,120"]');assert(byId('summary').textContent.includes('120 × 120'));
    click('[data-edge="rose"]');assert.equal(byId('edgeName').textContent,'玫瑰金');
    byId('whiteOpacity').value='32';byId('whiteOpacity').dispatchEvent(new window.Event('input'));assert.equal(document.querySelector('output[for="whiteOpacity"]').textContent,'32%');
    click('#compare');assert.equal(byId('compareBadge').hidden,false);
    click('#saveProject');const project=JSON.parse(await downloads.at(-1).text());assert.equal(project.state.base,'stars');assert.equal(project.state.whiteOpacity,32);
    click('[data-lighting="raking"]');assert.equal(byId('lightAzimuth').value,'68');assert.equal(byId('exposure').value,'90');
    click('[data-edge="sand-royal"]');assert.equal(byId('edgeName').textContent,'流沙宝蓝');click('[data-base="brush-silver"]');assert(byId('summary').textContent.includes('拉丝银葱'));
    click('#resetAll');assert(byId('summary').textContent.includes('幻彩拉丝闪底'));assert.equal(byId('compareBadge').hidden,true);
    const f=byId('projectFile');Object.defineProperty(f,'files',{value:[{size:100,text:async()=>JSON.stringify(project)}],configurable:true});f.dispatchEvent(new window.Event('change'));await wait();assert(byId('summary').textContent.includes('星星闪'),byId('toast').textContent);assert.equal(byId('whiteOpacity').value,'32');
    Object.defineProperty(f,'files',{value:[{size:100,text:async()=>'invalid'}],configurable:true});f.dispatchEvent(new window.Event('change'));await wait();assert(byId('toast').textContent.includes('有效的 JSON'));assert(byId('summary').textContent.includes('星星闪'));
  }finally{URL.createObjectURL=originalURL;}
});
