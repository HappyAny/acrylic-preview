import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {createProduct,disposeProduct} from './scene3d.js';
import {summary,labels} from './render.js';
import {studioEnvironmentTexture} from './lighting.js';

export function cameraDistance(width,height,aspect,fov=36){const tangent=Math.tan(THREE.MathUtils.degToRad(fov)/2);return Math.max(height/2/tangent,width/2/(tangent*aspect))*1.1;}
export function validCamera(value){return value&&['position','target'].every(k=>Array.isArray(value[k])&&value[k].length===3&&value[k].every(n=>Number.isFinite(n)&&Math.abs(n)<10))&&Math.hypot(...value.position.map((n,i)=>n-value.target[i]))>.01;}
export class AcrylicViewer{
  constructor(canvas,{onError=()=>{}}={}){
    if(!window.WebGL2RenderingContext)throw Error('当前浏览器未提供 WebGL 2，请使用支持硬件加速的 Chrome 或 Edge。');
    this.canvas=canvas;this.onError=onError;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.NeutralToneMapping;this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    this.renderer.debug.onShaderError=(gl,program,vs,fs)=>{console.error('Acrylic shader compile error',gl.getProgramInfoLog(program),gl.getShaderInfoLog(vs),gl.getShaderInfoLog(fs));onError('3D 材质着色器未能编译，请更新浏览器或显卡驱动。');};
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(36,1,.001,8);this.camera.position.set(.05,.03,.4);
    this.controls=new OrbitControls(this.camera,canvas);this.controls.enableDamping=false;this.controls.enablePan=true;this.controls.minDistance=.025;this.controls.maxDistance=3;this.controls.minPolarAngle=.04;this.controls.maxPolarAngle=Math.PI-.04;this.controls.addEventListener('change',()=>this.render());
    RectAreaLightUniformsLib.init();this.key=new THREE.RectAreaLight(0xffffff,1,.65,.8);this.fill=new THREE.RectAreaLight(0xffffff,.6,.5,.7);this.rim=new THREE.RectAreaLight(0xffffff,1,.2,.6);this.backFill=new THREE.RectAreaLight(0xffffff,1,.65,.8);this.backFill.position.set(-.15,.1,-.48);this.backFill.lookAt(0,0,0);this.scene.add(this.key,this.fill,this.rim,this.backFill);
    this.hemi=new THREE.HemisphereLight(0xffffff,0xf1f0ee,.12);this.scene.add(this.hemi);
    this.pmrem=new THREE.PMREMGenerator(this.renderer);this.pmrem.compileCubemapShader();this.state=null;this.spinning=false;
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);this.resize();
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;onError('显卡上下文已中断，恢复后将重新渲染；若持续出现请刷新。');});
    canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.lightKey='';if(this.state)this.updateLighting(this.state);this.render();});
    this.visibility=()=>{if(!document.hidden&&this.spinning)this.spinFrame();};document.addEventListener('visibilitychange',this.visibility);
  }
  resize(){
    const r=this.canvas.parentElement.getBoundingClientRect(),oldAspect=this.camera.aspect;
    this.width=Math.max(1,Math.round(r.width));this.height=Math.max(1,Math.round(r.height));this.renderer.setSize(this.width,this.height,false);
    this.camera.aspect=this.width/this.height;
    if(this.state&&oldAspect!==this.camera.aspect){const s=this.state,ratio=cameraDistance(s.width/1000,s.height/1000,this.camera.aspect)/cameraDistance(s.width/1000,s.height/1000,oldAspect);this.camera.position.sub(this.controls.target).multiplyScalar(ratio).add(this.controls.target);}
    this.camera.updateProjectionMatrix();this.controls.update();this.render();
  }
  setState(s,art,mask,comparison,patterns={}){
    const geomKeys=['backing','backingThickness','width','height','thickness','edge','edgeWidth','base','whiteMode','maskMode','whiteOpacity','inkOpacity','fit','scale','offsetX','offsetY','glitter','view','explode','bottomPattern','bottomColor','bottomOpacity','bottomSize','filmStructure','filmPitch','filmDirection','filmPatternFinish','filmPatternCoverage','filmMaskMode','film','filmStrength','filmPattern','filmColor','filmOpacity','filmSize'];
    const key=geomKeys.map(k=>s[k]).join('|'),first=!this.product,dimensionChanged=this.state&&(s.width!==this.state.width||s.height!==this.state.height),viewChanged=this.state?.view!==s.view;
    if(key!==this.productKey||this.art!==art||this.mask!==mask||this.patternBottom!==patterns.bottom||this.patternFilm!==patterns.film){if(this.product){this.scene.remove(this.product);disposeProduct(this.product);}this.product=createProduct(s,art,mask,patterns);this.scene.add(this.product);this.productKey=key;this.art=art;this.mask=mask;this.patternBottom=patterns.bottom;this.patternFilm=patterns.film;}
    if(comparison!==this.comparison){if(this.productA){this.scene.remove(this.productA);disposeProduct(this.productA);}this.productA=comparison?createProduct({...comparison.state,view:'finished'},comparison.art,comparison.mask,comparison.patterns):null;if(this.productA)this.scene.add(this.productA);this.comparison=comparison;}
    this.state={...s};
    const dark=s.background==='dark';this.scene.background=new THREE.Color(dark?'#292d33':'#efede7');
    if(s.background==='check'){if(!this.checker){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle='#eceae6';x.fillRect(0,0,64,64);x.fillStyle='#d9d6d1';x.fillRect(0,0,32,32);x.fillRect(32,32,32,32);this.checker=new THREE.CanvasTexture(c);this.checker.colorSpace=THREE.SRGBColorSpace;this.checker.wrapS=this.checker.wrapT=THREE.RepeatWrapping;this.checker.repeat.set(12,12);}this.scene.background=this.checker;}
    const glass=this.product.getObjectByName('acrylic-volume');if(glass)glass.material.envMapIntensity=.12+s.light/100*.28;
    this.updateLighting(s);if(first||dimensionChanged||viewChanged)this.resetCamera(s.view==='layers'?'layers':s.view==='back'?'back':'front');this.render();
  }
  updateLighting(s){
    const foilYaw=s.lightAzimuth*Math.PI/180,foilElev=s.lightElevation*Math.PI/180;
    for(const product of [this.product,this.productA])product?.traverse(obj=>{const u=obj.material?.userData.foilUniforms;if(u){u.uFoilLight.value.set(Math.sin(foilYaw)*Math.cos(foilElev),Math.sin(foilElev),Math.cos(foilYaw)*Math.cos(foilElev));u.uFoilBrightness.value=.15+s.keyLight/100*.7+s.environment/100*.15;}});
    for(const product of [this.product,this.productA])product?.traverse(obj=>{if(obj.material?.userData.laser){obj.material.uniforms.uLight.value=s.lightAzimuth*Math.PI/180;obj.material.uniforms.uBrightness.value=.25+s.keyLight/100*.5+s.environment/100*.5;}});
    this.scene.environmentIntensity=s.environment/100;this.renderer.toneMappingExposure=s.exposure/100;
    const k=[s.keyLight,s.fillLight,s.rimLight,s.lightAzimuth,s.lightElevation].join('|');if(k===this.lightKey)return;this.lightKey=k;
    const yaw=THREE.MathUtils.degToRad(s.lightAzimuth),elev=THREE.MathUtils.degToRad(s.lightElevation),radius=.48;
    this.key.position.set(Math.sin(yaw)*Math.cos(elev)*radius,Math.sin(elev)*radius,Math.cos(yaw)*Math.cos(elev)*radius);
    this.fill.position.set(.32,.08,.28);this.rim.position.set(.2,.22,-.24);for(const light of [this.key,this.fill,this.rim])light.lookAt(0,0,0);
    this.key.intensity=s.keyLight/100*1.2;this.fill.intensity=s.fillLight/100*.9;this.rim.intensity=s.rimLight/100*1.8;this.backFill.intensity=s.keyLight/100*1.2;
    const texture=studioEnvironmentTexture(s),old=this.environmentTarget;this.environmentTarget=this.pmrem.fromEquirectangular(texture);this.scene.environment=this.environmentTarget.texture;texture.dispose();old?.dispose();
  }
  resetCamera(view='front'){
    if(!this.state)return;const s=this.state,d=cameraDistance(s.width/1000,s.height/1000,this.camera.aspect);this.controls.target.set(0,0,s.view==='layers'?.03:0);
    const dirs={front:[0,0,1],back:[0,0,-1],side:[1,.07,.08],'three-quarter':[.3,.12,1],layers:[.8,.25,1]};const v=new THREE.Vector3(...(dirs[view]||dirs.front)).normalize().multiplyScalar(d*(s.view==='layers'?1.4:1));this.camera.position.copy(this.controls.target).add(v);this.controls.update();this.render();
  }
  getCamera(){return{position:this.camera.position.toArray(),target:this.controls.target.toArray()};}
  restoreCamera(value){if(!validCamera(value))return;this.camera.position.fromArray(value.position);this.controls.target.fromArray(value.target);this.controls.update();this.render();}
  zoom(factor){const v=this.camera.position.clone().sub(this.controls.target);v.setLength(THREE.MathUtils.clamp(v.length()*factor,this.controls.minDistance,this.controls.maxDistance));this.camera.position.copy(this.controls.target).add(v);this.controls.update();}
  setSpin(value){this.spinning=value;cancelAnimationFrame(this.spinRequest);if(value)this.spinFrame();}
  spinFrame(){if(!this.spinning||document.hidden)return;const v=this.camera.position.clone().sub(this.controls.target);v.applyAxisAngle(new THREE.Vector3(0,1,0),.006);this.camera.position.copy(this.controls.target).add(v);this.controls.update();this.render();this.spinRequest=requestAnimationFrame(()=>this.spinFrame());}
  render(){
    if(!this.state||this.lost)return;const renderer=this.renderer;this.product.visible=true;if(this.productA)this.productA.visible=false;
    if(this.productA&&this.state.view==='finished'){
      renderer.setScissorTest(true);renderer.setScissor(0,0,this.width/2,this.height);this.product.visible=false;this.productA.visible=true;renderer.render(this.scene,this.camera);
      renderer.setScissor(this.width/2,0,this.width-this.width/2,this.height);this.product.visible=true;this.productA.visible=false;renderer.render(this.scene,this.camera);renderer.setScissorTest(false);
    }else renderer.render(this.scene,this.camera);
  }
  capture(){
    if(this.lost)throw Error('3D 上下文已中断，暂时无法导出');const out=document.createElement('canvas');out.width=out.height=1800;const ctx=out.getContext('2d'),ratio=this.renderer.getPixelRatio(),w=this.width,h=this.height,savedPosition=this.camera.position.clone();
    try{this.width=1800;this.height=1600;this.renderer.setPixelRatio(1);this.renderer.setSize(1800,1600,false);this.camera.aspect=1800/1600;const s=this.state,fitRatio=cameraDistance(s.width/1000,s.height/1000,this.camera.aspect)/cameraDistance(s.width/1000,s.height/1000,w/h);this.camera.position.sub(this.controls.target).multiplyScalar(fitRatio).add(this.controls.target);this.camera.updateProjectionMatrix();this.render();ctx.drawImage(this.canvas,0,0);ctx.fillStyle='#f7f6f2';ctx.fillRect(0,1600,1800,200);ctx.textAlign='center';ctx.fillStyle='#61566d';ctx.font='30px "Microsoft YaHei", sans-serif';ctx.fillText('透色 3D / '+(this.state.view==='back'?'背面 · ':'')+summary(this.state),900,1655);ctx.font='23px "Microsoft YaHei", sans-serif';ctx.fillText(`${labels.whiteMode[this.state.whiteMode]} ${this.state.whiteOpacity}% · 亚克力 ${this.state.thickness} mm · ${this.state.backing==='none'?'无底板':`纸板 ${this.state.backingThickness} mm`} · ${this.comparison?'A/B 同光照对比 · ':''}曝光 ${(this.state.exposure/100).toFixed(2)}`,900,1700);ctx.font='20px "Microsoft YaHei", sans-serif';ctx.fillText('材质与光照为近似模拟，实际工艺以商家打样为准',900,1750);return out;}
    finally{this.width=w;this.height=h;this.renderer.setPixelRatio(ratio);this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.position.copy(savedPosition);this.camera.updateProjectionMatrix();this.render();}
  }
  dispose(){this.setSpin(false);this.resizeObserver.disconnect();this.controls.dispose();disposeProduct(this.product);disposeProduct(this.productA);this.environmentTarget?.dispose();this.pmrem.dispose();this.checker?.dispose();this.renderer.dispose();document.removeEventListener('visibilitychange',this.visibility);}
}
