import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const out='artifacts/local-laser-regression';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const set=async(id,value)=>{await page.locator('#'+id).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event(el.type==='range'?'input':'change',{bubbles:true}));},value);await settle();};
const click=async sel=>{await page.locator(sel).click();await settle();};
const shot=async name=>{await page.locator('#workspace').scrollIntoViewIfNeeded();await settle();await page.locator('#workspace').screenshot({path:`${out}/${name}.png`});};
const pixels=()=>page.locator('#preview').evaluate(c=>c.toDataURL());
try{
  await page.goto('http://127.0.0.1:4318/',{waitUntil:'networkidle'});await settle();
  const headings=await page.locator('.control-section h3').allTextContents();assert(headings[2].includes('03')&&headings[2].includes('尺寸'));assert(headings[3].includes('04')&&headings[3].includes('底色'));
  assert.equal(await page.locator('#film option[value="holo"]').count(),0);await set('film','gloss');assert(await page.locator('#laserControls').isHidden());await shot('01-clear-film');
  await set('filmPattern','stars');await set('filmSize',35);await set('filmOpacity',75);await shot('02-local-laser-stars');
  // Use genuine mouse input for the flat-mode optical tilt.
  const bounds=await page.locator('#flatPreview').boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2+100,bounds.y+bounds.height/2+30);await page.mouse.up();await settle();await shot('03-flat-tilted');
  await click('[data-preview-mode="3d"]');await page.waitForFunction(()=>document.getElementById('previewStatus').hidden,null,{timeout:20000});await shot('04-3d-front');const front=await pixels();await click('[data-camera="three-quarter"]');assert.notEqual(await pixels(),front);await shot('05-3d-angled');
  await click('[data-camera="front"]');await set('filmDirection',65);assert.notEqual(await pixels(),front);await shot('06-rotated-grating');
  for(const structure of ['cross','facets','rings']){await set('filmStructure',structure);await shot('07-'+structure);}
  await set('filmStructure','pillars');await set('filmDirection',0);await set('filmPattern','none');const plain=await pixels();await set('filmStructure','rings');assert.equal(await pixels(),plain,'no pattern means no laser anywhere');await set('filmPattern','stars');await click('[data-view="back"]');const back=await pixels();await set('film','none');assert.equal(await pixels(),back,'opaque paper blocks all front laser effects');
  await set('film','gloss');await click('[data-view="finished"]');const dp=page.waitForEvent('download');await click('#saveProject');await (await dp).saveAs(`${out}/project.json`);const project=JSON.parse(await readFile(`${out}/project.json`));assert.equal(project.version,6);assert.equal(project.state.filmPatternFinish,'laser');await click('#resetAll');await page.locator('#projectFile').setInputFiles(`${out}/project.json`);await page.waitForFunction(()=>document.getElementById('film').value==='gloss');assert.equal(await page.locator('#filmPatternFinish').inputValue(),'laser');
  await page.setViewportSize({width:390,height:844});await click('[data-preview-mode="flat"]');await shot('08-mobile');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);await writeFile(`${out}/report.json`,JSON.stringify({passed:true,headings,errors,checks:['section order','flat structure and angle','3D shader compile','angle-sensitive rainbow','four structures','rear occlusion','v5 optical settings roundtrip','mobile width']},null,2));console.log('Laser regression passed');
}finally{await browser.close();}
