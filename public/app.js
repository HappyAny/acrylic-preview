import {defaults,sanitizeState,enums} from './model.js';
import {drawScene,planes,summary,labels} from './render.js';
import {edgeMaterials,baseMaterials,lightingPresets} from './materials.js';
import {patternNames,filmNames,filmPatternTemplate} from './decoration.js';
const $=id=>document.getElementById(id);
let state={...defaults},art=null,mask=null,artData=null,maskData=null,artName='月光花园 · 示例画稿',maskName='',comparison=null,scheduled=false,toastTimer;
const canvas=$('preview');
const flatCanvas=$('flatPreview'),patternImages={bottom:null,film:null},patternData={bottom:null,film:null},patternFileNames={bottom:'',film:''},patternRequests={bottom:0,film:0};
let viewer=null,pendingCamera=null,renderFailed=false,starting3D=false;
const finishNames={sand:'流沙颗粒',brushed:'定向拉丝',glitter:'细闪颗粒',holo:'随角变色',mirror:'镜面反射',matte:'柔和哑光',none:'裸露亚克力'};
$('shopBases').innerHTML=baseMaterials.filter(m=>!m.legacy).map(m=>`<button data-base="${m.id}" class="material" title="${m.label}"><span class="material-chip texture-${m.finish}" style="background-color:${m.color}"></span><strong>${m.label}</strong><small>${m.tentative?'名称待确认':finishNames[m.finish]}</small></button>`).join('');
$('shopEdges').innerHTML=edgeMaterials.filter(m=>!m.legacy).map(m=>`<button data-edge="${m.id}" class="edge-card" title="${m.label}"><i class="texture-${m.finish}" style="--material-color:${m.color}"></i><span>${m.label}</span></button>`).join('');
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4200);}
function redraw(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;if(state.previewMode==='flat'){const r=flatCanvas.parentElement.getBoundingClientRect?.();if(r?.width&&r?.height){const ratio=Math.min(window.devicePixelRatio||1,1.5),w=Math.round(r.width*ratio),h=Math.round(r.height*ratio);if(flatCanvas.width!==w||flatCanvas.height!==h){flatCanvas.width=w;flatCanvas.height=h;}}drawScene(flatCanvas,state,art,mask,{comparison,patterns:patternImages});return;}if(viewer){try{viewer.setState(state,art,mask,comparison,patternImages);if(pendingCamera){viewer.restoreCamera(pendingCamera);pendingCamera=null;}}catch(e){show3DError(e.message);}}else if(!starting3D&&!renderFailed)start3D();});}
function show3DError(message){renderFailed=true;$('previewStatus').hidden=state.previewMode!=='3d';$('previewStatus').textContent=message;$('exportPreview').disabled=state.previewMode==='3d';}
async function start3D(){starting3D=true;try{const {AcrylicViewer}=await import('./viewer3d.bundle.js');viewer=new AcrylicViewer(canvas,{onError:show3DError});viewer.setState(state,art,mask,comparison,patternImages);if(pendingCamera){viewer.restoreCamera(pendingCamera);pendingCamera=null;}if(!renderFailed){$('previewStatus').hidden=true;$('exportPreview').disabled=false;}}catch(e){show3DError(e.message||'无法启动 3D 预览，可继续使用平面效果模式。');}finally{starting3D=false;}}
function sync(){
  for(const key of Object.keys(defaults)){const el=$(key);if(el)el.value=state[key];}
  document.querySelectorAll('output[for]').forEach(el=>{const k=el.getAttribute('for');el.textContent=k==='exposure'?(state[k]/100).toFixed(2)+'×':state[k]+(['edgeWidth','bottomSize','filmSize','filmPitch'].includes(k)?' mm':['lightAzimuth','lightElevation','filmDirection'].includes(k)?'°':'%');});
  for(const [attr,key] of [['view','view'],['bg','background'],['white','whiteMode'],['base','base'],['edge','edge']]) document.querySelectorAll(`[data-${attr}]`).forEach(b=>{const active=b.dataset[attr]===state[key];b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});
  const preset=`${state.width},${state.height}`,known=['100,150','120,120','148,210'].includes(preset);
  document.querySelectorAll('[data-size]').forEach(b=>{const active=b.dataset.size===(known?preset:'custom');b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});
  $('previewDimensions').textContent=`${state.width} × ${state.height} mm · 亚克力 ${state.thickness} mm · ${state.backing==='none'?'无底板':`纸板 ${state.backingThickness} mm`}`;
  $('maskControls').hidden=state.whiteMode!=='upload';$('edgeName').textContent=labels.edge[state.edge];$('summary').textContent=summary(state);
  $('colorName').textContent=artName||'上传彩层画稿';$('maskName').textContent=maskName||'＋ 选择白墨图';
  $('whiteHelp').textContent=state.whiteMode==='auto'?'按彩稿透明度生成白墨；不透明的 JPG 会铺满画稿矩形。':state.whiteMode==='full'?'整个色纸铺白墨，闪底会被遮住；降低遮盖可模拟薄白墨。':state.whiteMode==='none'?'不印白墨，彩层会透出底材；透明底上的颜色较通透。':mask?'白墨与彩稿使用同一画布坐标和变换。灰度可表达不同遮盖程度。':'尚未选择白墨图，目前按无白墨显示。';
  $('compareBadge').hidden=!comparison||state.view!=='finished';$('compare').textContent=comparison?'× 取消 A / B 对比':'＋ 固定方案 A';
  $('compareDivider').hidden=!comparison||state.view!=='finished';$('explodeControl').hidden=state.view!=='layers';
  const flat=state.previewMode==='flat';flatCanvas.hidden=!flat;canvas.hidden=flat;$('cameraToolbar').hidden=flat;$('lightingSection').hidden=flat;$('explodeControl').hidden=flat||state.view!=='layers';$('previewStatus').hidden=flat||!!viewer&&!renderFailed;$('exportPreview').disabled=!flat&&(!viewer||renderFailed);
  $('foilVisibilityHelp').textContent=state.whiteMode==='full'&&state.whiteOpacity===100?'当前是 100% 满版白墨，闪底被完全遮住。可降低白墨遮盖，或在图层分解中查看闪底。':state.whiteMode==='auto'&&state.whiteOpacity===100?'当前白墨跟随画稿：不透明图像区域会挡住闪底，PNG 的透明留空处可见闪光。':'闪底在白墨和画稿下方，仅透底区域可见；背面的纸板底纹不闪光。';
  $('modeDescription').textContent=flat?'正面看画稿与工艺搭配':'旋转看厚度与反光';document.querySelectorAll('[data-preview-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.previewMode===state.previewMode);b.setAttribute('aria-pressed',b.dataset.previewMode===state.previewMode);});
  const noBacking=state.backing==='none';$('foilControls').hidden=noBacking;$('rearPatternSection').hidden=noBacking;$('backingThicknessControl').hidden=noBacking;$('backingHelp').textContent=noBacking?'没有纸板、闪底和背面底纹；留空区域可透光，白墨区域仍遮光。':'不透明纸板：朝亚克力的一面是闪底，向外的一面是底纹。';
  $('bottomPatternControls').hidden=state.bottomPattern==='none';$('bottomUpload').hidden=state.bottomPattern!=='custom';$('bottomSizeControl').hidden=state.bottomPattern==='custom';$('bottomColor').parentElement.hidden=state.bottomPattern==='custom';
  $('filmControls').hidden=state.film==='none';$('filmPatternControls').hidden=state.filmPattern==='none';$('filmUpload').hidden=state.filmPattern!=='custom';$('filmSizeControl').hidden=state.filmPattern==='custom';$('filmColor').parentElement.hidden=(state.filmPattern==='custom'&&state.filmMaskMode==='alpha')||state.filmPatternFinish==='laser';$('filmMaskModeControl').hidden=state.filmPattern!=='custom';$('laserControls').hidden=state.filmPattern==='none'||state.filmPatternFinish!=='laser';
  const opaquePattern=state.filmPatternCoverage==='opaque';$('filmOpacityControl').hidden=opaquePattern&&state.filmPatternFinish==='ink';$('filmOpacityLabel').textContent=opaquePattern?'镭射变色强度':'膜纹强度';$('patternCoverageHelp').textContent=opaquePattern?'花纹实体区域遮住画稿；上传 PNG 的透明留空与半透明边缘仍保留。镭射强度只改变色彩，不改变遮盖。':'花纹可透出下方画稿，膜纹强度同时影响可见程度。';
  for(const slot of ['bottom','film'])$(slot+'FileName').textContent=patternFileNames[slot]||(slot==='bottom'?'＋ 上传底纹图案':'＋ 上传膜上花纹');
  document.querySelectorAll('[data-lighting]').forEach(b=>{b.classList.toggle('active',b.dataset.lighting===state.lighting);b.setAttribute('aria-pressed',b.dataset.lighting===state.lighting);});
  $('viewHint').textContent=state.view==='finished'?(flat?'正面效果 · 拖动查看反光示意':'拖动旋转 · 滚轮缩放 · 右键平移'):state.view==='layers'?'纸板（外侧底纹 / 内侧闪底） → 白墨 → 彩层 → 亚克力 → 覆膜':state.view==='back'?(noBacking?'无底板 · 从背面看白墨与彩层':'纸板外侧 · 底纹；正面画稿不会透出'):state.view==='white'?'白色为印墨区域 · 透明区域留空':'彩稿原始图层';
  if(art){const rectScale=(state.fit==='cover'?Math.max(state.width/art.naturalWidth,state.height/art.naturalHeight):Math.min(state.width/art.naturalWidth,state.height/art.naturalHeight))*state.scale/100;const dpi=Math.round(25.4/rectScale);$('resolutionInfo').textContent=artData?`${art.naturalWidth} × ${art.naturalHeight} px · 有效精度约 ${dpi} DPI${dpi<150?' · 精度偏低，建议换更清晰画稿':''}`:'示例画稿 · 可替换为你的图片';}
  redraw();
}
for(const key of Object.keys(defaults)){
  const el=$(key);if(!el)continue;
  el.addEventListener(el.type==='range'?'input':'change',()=>{const numeric=typeof defaults[key]==='number';if(numeric&&el.value.trim()===''){sync();return;}state=sanitizeState({...state,[key]:numeric?Number(el.value):el.value});if(['keyLight','fillLight','rimLight','environment','exposure','lightAzimuth','lightElevation'].includes(key))state.lighting='custom';sync();});
}
for(const [attr,key] of [['view','view'],['bg','background'],['white','whiteMode'],['base','base'],['edge','edge']])document.querySelectorAll(`[data-${attr}]`).forEach(button=>button.addEventListener('click',()=>{state[key]=button.dataset[attr];sync();}));
document.querySelectorAll('[data-size]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.size==='custom'){$('width').focus();$('width').select();return;}[state.width,state.height]=button.dataset.size.split(',').map(Number);sync();}));
function readData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('无法读取这个文件'));reader.readAsDataURL(file);});}
function loadImage(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{if(img.naturalWidth*img.naturalHeight>40000000){reject(Error('图片超过 4000 万像素，请先缩小后再上传'));return;}resolve(img);};img.onerror=()=>reject(Error('图片无法解码，请使用 PNG、JPG 或 WebP'));img.src=url;});}
let colorRequest=0,maskRequest=0;
async function upload(file,kind){
  if(!file)return;
  const ticket=kind==='color'?++colorRequest:++maskRequest;
  try{
    if(file.size>20*1024*1024)throw Error('单张图片请小于 20 MB');
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('请使用 PNG、JPG 或 WebP 图片');
    const data=await readData(file),img=await loadImage(data);
    if(ticket!==(kind==='color'?colorRequest:maskRequest))return;
    if(kind==='color'){art=img;artData=data;artName=file.name;}else{mask=img;maskData=data;maskName=file.name;state.whiteMode='upload';}
    sync();if(mask&&art&&(mask.naturalWidth!==art.naturalWidth||mask.naturalHeight!==art.naturalHeight))toast('两张图的像素尺寸不同，白墨已映射到彩稿画布，请在白墨视图检查对齐');else toast(kind==='color'?'彩层已更新':'白墨图已对齐');
  }catch(error){toast(error.message);}
}
$('colorFile').addEventListener('change',e=>{upload(e.target.files[0],'color');e.target.value='';});
$('maskFile').addEventListener('change',e=>{upload(e.target.files[0],'mask');e.target.value='';});
async function uploadPattern(file,slot){if(!file)return;const ticket=++patternRequests[slot];try{if(file.size>20*1024*1024)throw Error('单张图案请小于 20 MB');if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('图案请使用 PNG、JPG 或 WebP');const data=await readData(file),img=await loadImage(data);if(ticket!==patternRequests[slot])return;patternImages[slot]=img;patternData[slot]=data;patternFileNames[slot]=file.name;state[slot+'Pattern']='custom';if(slot==='film'&&state.film==='none')state.film='gloss';sync();toast(slot==='bottom'?'底纹图案已更新':'膜上图案已更新');}catch(e){toast(e.message);}}
for(const slot of ['bottom','film'])$(slot+'File').addEventListener('change',e=>{uploadPattern(e.target.files[0],slot);e.target.value='';});
for(const [id,kind] of [['colorDrop','color']]){const el=$(id);el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('dragover');});el.addEventListener('dragleave',()=>el.classList.remove('dragover'));el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('dragover');upload(e.dataTransfer.files[0],kind);});}
async function demo(){const ticket=++colorRequest;try{const image=await loadImage('/demo.svg');if(ticket!==colorRequest)return;art=image;artData=null;artName='月光花园 · 示例画稿';maskRequest++;mask=null;maskData=null;maskName='';state.whiteMode='auto';sync();}catch(error){toast(error.message);}}
$('loadDemo').addEventListener('click',demo);
$('resetAll').addEventListener('click',()=>{state={...defaults};comparison=null;viewer?.setSpin(false);$('autoRotate').setAttribute('aria-pressed','false');sync();viewer?.resetCamera('front');toast('搭配已重置，上传的画稿仍然保留');});
$('resetAngle').addEventListener('click',()=>{state.angleX=state.angleY=0;if(state.previewMode==='3d')viewer?.resetCamera(state.view==='back'?'back':'front');else redraw();});
document.querySelectorAll('[data-preview-mode]').forEach(b=>b.addEventListener('click',()=>{state.previewMode=b.dataset.previewMode;viewer?.setSpin(false);$('autoRotate').setAttribute('aria-pressed','false');sync();if(state.previewMode==='3d')viewer?.resize();}));
let flatDrag=null;flatCanvas.addEventListener('pointerdown',e=>{flatDrag={x:e.clientX,y:e.clientY,ax:state.angleX,ay:state.angleY};flatCanvas.setPointerCapture(e.pointerId);});flatCanvas.addEventListener('pointermove',e=>{if(!flatDrag)return;state.angleY=Math.max(-25,Math.min(25,flatDrag.ay+(e.clientX-flatDrag.x)*.12));state.angleX=Math.max(-20,Math.min(20,flatDrag.ax+(e.clientY-flatDrag.y)*.09));redraw();});for(const event of ['pointerup','pointercancel'])flatCanvas.addEventListener(event,()=>flatDrag=null);
document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>{if(['front','back'].includes(b.dataset.camera)){state.view=b.dataset.camera==='back'?'back':'finished';sync();}viewer?.resetCamera(b.dataset.camera);}));
$('zoomIn').addEventListener('click',()=>viewer?.zoom(.85));$('zoomOut').addEventListener('click',()=>viewer?.zoom(1.18));
$('autoRotate').addEventListener('click',()=>{const active=$('autoRotate').getAttribute('aria-pressed')!=='true';$('autoRotate').setAttribute('aria-pressed',active);viewer?.setSpin(active);});
document.querySelectorAll('[data-lighting]').forEach(b=>b.addEventListener('click',()=>{state=sanitizeState({...state,...lightingPresets[b.dataset.lighting],lighting:b.dataset.lighting});sync();}));
$('compare').addEventListener('click',()=>{comparison=comparison?null:{state:{...state,view:'finished'},art,mask,patterns:{...patternImages}};state.view='finished';sync();if(comparison)toast('左侧为已固定的方案 A，右侧会随你的修改更新');});
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);}
function downloadCanvas(c,name){return new Promise((resolve,reject)=>c.toBlob(blob=>{if(!blob){reject(Error('图片导出失败，请重试'));return;}download(blob,name);resolve();},'image/png'));}
$('exportPreview').addEventListener('click',async()=>{const b=$('exportPreview');b.disabled=true;try{let c;if(state.previewMode==='flat'){c=document.createElement('canvas');c.width=c.height=1800;drawScene(c,state,art,mask,{caption:true,comparison,patterns:patternImages});}else{if(!viewer||renderFailed)throw Error('3D 预览尚未就绪');viewer.setState(state,art,mask,comparison,patternImages);c=viewer.capture();}await downloadCanvas(c,`透色-${state.previewMode}-${state.width}x${state.height}.png`);toast('已导出当前模式的效果图');}catch(e){toast(e.message);}finally{b.disabled=state.previewMode==='3d'&&(!viewer||renderFailed);}});
$('exportFilmTemplate').addEventListener('click',async()=>{try{await downloadCanvas(filmPatternTemplate(state,patternImages.film),`膜上花纹画布-${state.width}x${state.height}mm.png`);toast('花纹画布已下载：白色为图案，黑色为留空。编辑后上传即可。');}catch(e){toast(e.message);}});
$('exportMask').addEventListener('click',async()=>{try{await downloadCanvas(planes(state,art,mask,1800).white,`白墨预览-${state.width}x${state.height}mm.png`);toast('已导出透明背景白墨预览，印刷文件规格请与商家确认');}catch(e){toast(e.message);}});
$('saveProject').addEventListener('click',()=>{const project={format:'acrylic-studio',version:6,state,camera:viewer?.getCamera()||null,art:artData,mask:maskData,artName,maskName,patterns:patternData,patternNames:patternFileNames};download(new Blob([JSON.stringify(project)],{type:'application/json'}),'透色-搭配方案.json');toast('方案已导出，包含画稿、底纹、覆膜、光照与视角');});
$('importProject').addEventListener('click',()=>$('projectFile').click());
$('projectFile').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;const ticket=++colorRequest;maskRequest++;try{
  if(file.size>120*1024*1024)throw Error('方案文件超过 120 MB');
  const project=JSON.parse(await file.text());if(project.format!=='acrylic-studio'||![1,2,3,4,5,6].includes(project.version))throw Error('不是受支持的透色方案文件');
  const pd=project.patterns||{};for(const data of [project.art,project.mask,pd.bottom,pd.film])if(data!=null&&(typeof data!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data)))throw Error('方案图片格式不受支持');
  const [newArt,newMask,newBottom,newFilm]=await Promise.all([loadImage(project.art||'/demo.svg'),project.mask?loadImage(project.mask):Promise.resolve(null),pd.bottom?loadImage(pd.bottom):Promise.resolve(null),pd.film?loadImage(pd.film):Promise.resolve(null)]);
  if(ticket!==colorRequest)return;
  state=sanitizeState({...project.state,...(project.version<5?{filmPatternFinish:'ink'}:{}),...(project.version<6?{filmMaskMode:'alpha'}:{})});art=newArt;mask=newMask;artData=project.art||null;maskData=project.mask||null;artName=typeof project.artName==='string'?project.artName.slice(0,200):'导入彩稿';maskName=typeof project.maskName==='string'?project.maskName.slice(0,200):'';comparison=null;pendingCamera=project.camera||null;sync();toast('方案已恢复');
  patternImages.bottom=newBottom;patternImages.film=newFilm;for(const slot of ['bottom','film']){patternRequests[slot]++;patternData[slot]=pd[slot]||null;patternFileNames[slot]=typeof project.patternNames?.[slot]==='string'?project.patternNames[slot].slice(0,200):'';}sync();
}catch(error){toast(error instanceof SyntaxError?'文件不是有效的 JSON 方案':error.message);}});
if(window.ResizeObserver){const previewResize=new window.ResizeObserver(()=>redraw());previewResize.observe(flatCanvas.parentElement);}
sync();demo();
