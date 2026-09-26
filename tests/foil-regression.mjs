import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out='artifacts/foil-regression';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const set=async(id,v)=>{await page.locator('#'+id).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event(el.type==='range'?'input':'change',{bubbles:true}));},v);await settle();};
const click=async s=>{await page.locator(s).click();await settle();};
const shot=async n=>{await page.locator('#workspace').scrollIntoViewIfNeeded();await page.locator('#workspace').screenshot({path:`${out}/${n}.png`});};
try{
  await page.goto('http://127.0.0.1:4318/',{waitUntil:'networkidle'});await settle();await click('[data-base="silver-glitter"]');await shot('01-flat-front');
  const r=await page.locator('#flatPreview').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+130,r.y+r.height/2+40,{steps:6});await page.mouse.up();await settle();await shot('02-flat-tilt');
  await click('[data-preview-mode="3d"]');await page.waitForFunction(()=>document.getElementById('previewStatus').hidden,null,{timeout:20000});await settle();await shot('03-3d-front');await click('[data-camera="three-quarter"]');await shot('04-3d-tilt');
  await click('[data-base="brush-silver"]');await shot('05-brushed-tilt');await click('[data-camera="front"]');await shot('06-brushed-front');
  // Probe the same physical foil points from two cameras, avoiding changes caused only by screen projection.
  const samples=await page.evaluate(async()=>{
    const {AcrylicViewer}=await import('/viewer3d.bundle.js'),{defaults}=await import('/model.js');
    const host=document.createElement('div');host.style.cssText='position:fixed;left:0;top:0;width:700px;height:700px;z-index:100';document.body.append(host);const canvas=document.createElement('canvas');host.append(canvas);const viewer=new AcrylicViewer(canvas);let records=[];
    try{
      for(const base of ['silver-glitter','brush-silver','brush-holo']){
        viewer.setState({...defaults,base,edge:'none',whiteMode:'none',glitter:85},null,null,null);
        const points=[];for(let y=-5;y<=5;y++)for(let x=-4;x<=4;x++)points.push([x*.009,y*.011,-.00145]);
        const read=()=>{viewer.render();const gl=canvas.getContext('webgl2');return points.map(([x,y,z])=>{const v=viewer.camera.position.clone().set(x,y,z).project(viewer.camera),p=new Uint8Array(4);gl.readPixels(Math.round((v.x*.5+.5)*canvas.width),Math.round((v.y*.5+.5)*canvas.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p].slice(0,3);});};
        viewer.resetCamera('front');const front=read();viewer.resetCamera('three-quarter');const angled=read();const changes=front.map((p,i)=>Math.max(...p.map((v,k)=>Math.abs(v-angled[i][k]))));records.push({base,changed:changes.filter(v=>v>8).length,max:Math.max(...changes),average:changes.reduce((a,b)=>a+b,0)/changes.length});
        viewer.setState({...defaults,base,edge:'none',whiteMode:'full',glitter:0},null,null,null);const covered=read();viewer.setState({...defaults,base,edge:'none',whiteMode:'full',glitter:100},null,null,null);const coveredStrong=read();records.at(-1).coveredUnchanged=JSON.stringify(covered)===JSON.stringify(coveredStrong);
      }
    }finally{viewer.dispose();host.remove();}return records;
  });
  for(const r of samples){assert(r.changed>10,JSON.stringify(r));assert(r.max>15,JSON.stringify(r));assert(r.coveredUnchanged,JSON.stringify(r));}
  await click('[data-white="full"]');assert((await page.locator('#foilVisibilityHelp').textContent()).includes('完全遮住'));await shot('07-white-blocks-foil');
  assert.deepEqual(errors,[]);await writeFile(`${out}/report.json`,JSON.stringify({passed:true,errors,samples},null,2));console.log(JSON.stringify({passed:true,samples}));
}finally{await browser.close();}
