import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createCanvas} from '@napi-rs/canvas';
const out='artifacts/backing-regression';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const set=async(id,value)=>{await page.locator('#'+id).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event(el.type==='range'?'input':'change',{bubbles:true}));},value);await settle();};
const click=async selector=>{await page.locator(selector).click();await settle();};
const pixels=()=>page.locator('#flatPreview').evaluate(c=>c.toDataURL());
const gpuPixels=()=>page.locator('#preview').evaluate(c=>c.toDataURL());
const shot=async name=>{await page.locator('#workspace').scrollIntoViewIfNeeded();await settle();await page.locator('#workspace').screenshot({path:`${out}/${name}.png`});};
try{
  await page.goto('http://127.0.0.1:4318/',{waitUntil:'networkidle'});await settle();
  await click('[data-white="none"]');const front=await pixels();await set('bottomPattern','hearts');await set('bottomColor','gold');await set('bottomOpacity',100);assert.equal(await pixels(),front);await shot('01-front-no-rear-pattern');
  await click('[data-view="back"]');const back=await pixels();assert.notEqual(back,front);await shot('02-paper-back');await click('[data-white="full"]');await set('film','gloss');await set('filmPattern','stars');assert.equal(await pixels(),back);
  // Asymmetric rear artwork confirms orientation, solid paper under transparent pixels.
  const c=createCanvas(200,300),ctx=c.getContext('2d');ctx.fillStyle='#ce3466';ctx.fillRect(15,25,60,95);ctx.fillStyle='#256cb7';ctx.fillRect(135,175,45,95);ctx.fillStyle='#333';ctx.font='24px sans-serif';ctx.fillText('BACK',25,150);await writeFile(`${out}/rear.png`,c.toBuffer('image/png'));
  await set('bottomPattern','custom');await page.locator('#bottomFile').setInputFiles(`${out}/rear.png`);await page.waitForFunction(()=>document.getElementById('bottomFileName').textContent==='rear.png');await settle();await shot('03-custom-back-flat');
  await set('backing','none');assert(await page.locator('#foilControls').isHidden());assert(await page.locator('#rearPatternSection').isHidden());await click('[data-white="none"]');await click('[data-bg="check"]');await shot('04-no-backing-rear-flat');
  await set('backing','cardboard');await click('[data-preview-mode="3d"]');await page.waitForFunction(()=>document.getElementById('previewStatus').hidden,null,{timeout:20000});await settle();await shot('05-custom-back-3d');
  const gpuBack=await gpuPixels();await click('[data-white="full"]');assert.equal(await gpuPixels(),gpuBack,'opaque cardboard must hide white and color changes');
  await click('[data-view="finished"]');await set('film','none');await click('[data-white="none"]');const gpuFront=await gpuPixels();await set('bottomPattern','none');assert.equal(await gpuPixels(),gpuFront,'rear art must never change front');await shot('06-front-3d');
  await set('bottomPattern','custom');await click('[data-camera="side"]');await shot('07-side-paper-and-acrylic');await click('[data-view="layers"]');await shot('08-exploded');
  await set('backing','none');await click('[data-view="back"]');await shot('09-no-backing-rear-3d');await click('[data-white="full"]');await shot('10-no-backing-white-rear-3d');await click('[data-view="finished"]');await click('[data-white="none"]');await shot('11-no-backing-front-3d');
  const unbackedArt=await gpuPixels();await set('inkOpacity',0);assert.notEqual(await gpuPixels(),unbackedArt,'transparent acrylic must not swallow the color layer');await set('inkOpacity',100);
  const downloadPromise=page.waitForEvent('download');await click('#saveProject');await (await downloadPromise).saveAs(`${out}/project.json`);const project=JSON.parse(await readFile(`${out}/project.json`));assert.equal(project.version,6);assert.equal(project.state.backing,'none');
  await click('#resetAll');await page.locator('#projectFile').setInputFiles(`${out}/project.json`);await page.waitForFunction(()=>document.getElementById('backing').value==='none');assert(await page.locator('#foilControls').isHidden());
  await page.setViewportSize({width:390,height:844});await click('[data-preview-mode="flat"]');await click('[data-view="back"]');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('12-mobile-back');
  assert.deepEqual(errors,[]);await writeFile(`${out}/report.json`,JSON.stringify({passed:true,errors,checks:['rear pattern does not change front in both modes','opaque rear hides ink and film','asymmetric custom rear artwork','optional cardboard removes foil and rear pattern','paper and acrylic thickness','3D exploded layers','no backing front/rear white ink','v6 backing roundtrip','mobile back view']},null,2));console.log('Backing browser regression passed');
}finally{await browser.close();}
