import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createCanvas} from '@napi-rs/canvas';
const out='artifacts/omni-regression';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const set=async(id,v)=>{await page.locator('#'+id).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event(el.type==='range'?'input':'change',{bubbles:true}));},v);await settle();};
const click=async sel=>{await page.locator(sel).click();await settle();};
const shot=async name=>{await page.locator('#workspace').scrollIntoViewIfNeeded();await settle();await page.locator('#workspace').screenshot({path:`${out}/${name}.png`});};
const sample=async mode=>page.locator(mode==='flat'?'#flatPreview':'#preview').evaluate((c,mode)=>{if(mode==='flat')return [...c.getContext('2d').getImageData(c.width/2,c.height/2,1,1).data];const gl=c.getContext('webgl2'),p=new Uint8Array(4);gl.readPixels(c.width/2,c.height/2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p];},mode);
try{
  await page.goto('http://127.0.0.1:4318/',{waitUntil:'networkidle'});await settle();
  const mask=createCanvas(200,300),ctx=mask.getContext('2d');ctx.fillStyle='#e74781';ctx.fillRect(40,70,120,160);await writeFile(`${out}/pattern.png`,mask.toBuffer('image/png'));
  await set('film','gloss');await set('filmMaskMode','alpha');await set('filmPattern','custom');await page.locator('#filmFile').setInputFiles(`${out}/pattern.png`);await page.waitForFunction(()=>document.getElementById('filmFileName').textContent==='pattern.png');
  await set('filmPatternCoverage','opaque');await set('filmStructure','omni');await set('filmOpacity',85);await shot('01-flat-opaque-omni');
  const flat=await sample('flat');await set('inkOpacity',0);assert.deepEqual(await sample('flat'),flat);await set('inkOpacity',100);
  await click('[data-preview-mode="3d"]');await page.waitForFunction(()=>document.getElementById('previewStatus').hidden,null,{timeout:20000});await settle();await shot('02-3d-opaque-omni');
  const opaque=await sample('3d');await set('inkOpacity',0);assert.deepEqual(await sample('3d'),opaque,'opaque pattern blocks underlying ink');await set('inkOpacity',100);
  await set('filmPatternCoverage','translucent');const translucent=await sample('3d');await set('inkOpacity',0);assert.notDeepEqual(await sample('3d'),translucent);await set('inkOpacity',100);await set('filmPatternCoverage','opaque');
  const directions=[];for(let i=0;i<8;i++){await click('[data-camera="front"]');const r=await page.locator('#preview').boundingBox(),angle=i*Math.PI/4;await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+65*Math.cos(angle),r.y+r.height/2+65*Math.sin(angle),{steps:5});await page.mouse.up();await settle();directions.push(await sample('3d'));await shot('03-angle-'+i);}
  assert(new Set(directions.map(p=>p.join(','))).size>=6);await click('[data-camera="front"]');
  await set('filmPatternFinish','ink');assert(await page.locator('#filmOpacityControl').isHidden());const ink=await sample('3d');await set('inkOpacity',0);assert.deepEqual(await sample('3d'),ink);await set('inkOpacity',100);await shot('04-opaque-ink');await set('filmPatternFinish','laser');
  const dp=page.waitForEvent('download');await click('#saveProject');await (await dp).saveAs(`${out}/project.json`);const p=JSON.parse(await readFile(`${out}/project.json`));assert.equal(p.state.filmPatternCoverage,'opaque');assert.equal(p.state.filmStructure,'omni');await click('#resetAll');await page.locator('#projectFile').setInputFiles(`${out}/project.json`);await page.waitForFunction(()=>document.getElementById('filmPatternCoverage').value==='opaque');assert.equal(await page.locator('#filmStructure').inputValue(),'omni');
  await page.setViewportSize({width:390,height:844});await click('[data-preview-mode="flat"]');await shot('05-mobile');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  await writeFile(`${out}/report.json`,JSON.stringify({passed:true,errors,directions,checks:['opaque pixels block underlying art in 2D and 3D','translucent patterns transmit art','eight viewing directions','opaque printed patterns','saved settings round trip','mobile']},null,2));console.log('Opaque and omnidirectional browser checks passed');
}finally{await browser.close();}
