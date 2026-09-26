import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const phase=process.argv[2]||'current',out=new URL(`../artifacts/visual-${phase}/`,import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
const errors=[],consoleErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
try{
  await page.goto('http://127.0.0.1:4318/',{waitUntil:'networkidle'});
  await page.locator('[data-preview-mode="3d"]').click();
  await page.waitForFunction(()=>document.getElementById('previewStatus').hidden,{timeout:20000});
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await settle();await page.locator('#workspace').screenshot({path:new URL('default.png',out).pathname.replace(/^\/([A-Z]:)/,'$1')});
  await page.locator('[data-camera="front"]').click();await settle();await page.locator('#workspace').screenshot({path:new URL('front.png',out).pathname.replace(/^\/([A-Z]:)/,'$1')});
  await page.locator('[data-base="silver-glitter"]').click();await settle();await page.locator('#workspace').screenshot({path:new URL('silver-front.png',out).pathname.replace(/^\/([A-Z]:)/,'$1')});
  for(const [name,values] of [['ink100',{inkOpacity:100}],['exposure65',{exposure:65}],['environment45',{exposure:85,environment:45}],['no-reflection',{light:0,environment:60,exposure:80}]]){
    for(const [id,value] of Object.entries(values))await page.locator('#'+id).evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
    await settle();await page.locator('#workspace').screenshot({path:new URL(name+'.png',out).pathname.replace(/^\/([A-Z]:)/,'$1')});
  }
  const renderer=await page.locator('#preview').evaluate(c=>{const gl=c.getContext('webgl2');const e=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:gl.getParameter(e?e.UNMASKED_RENDERER_WEBGL:gl.RENDERER),width:c.width,height:c.height};});
  await writeFile(new URL('report.json',out),JSON.stringify({errors,consoleErrors,renderer},null,2));console.log(JSON.stringify({phase,errors,consoleErrors,renderer}));
}finally{await browser.close();}
