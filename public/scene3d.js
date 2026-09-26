import * as THREE from 'three';
import {baseById,edgeById,foilKind} from './materials.js';
import {planes} from './render.js';
import {decorationCanvas,paperBackCanvas} from './decoration.js';

export function noise(x,y){let n=Math.imul(x+19,374761393)+Math.imul(y+61,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;}
export function grainData(finish,size=256){
  const normal=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4),film=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;let a=noise(Math.floor(x/2),Math.floor(y/2))-.5,b=noise(Math.floor(x/2)+77,Math.floor(y/2))-.5;
    if(finish==='brushed'){a=(noise(x,0)-.5)*.65+(noise(x,Math.floor(y/32))-.5)*.08;b*=.02;}
    if(finish==='sand'){a=noise(Math.floor((x+y*.3)/2),Math.floor(y/5))-.5;b*=.3;}
    if(['mirror','matte','holo','smooth','pearl','clear'].includes(finish)){a*=.025;b*=.025;}
    if(finish==='stars'){const gx=x%40-20,gy=y%40-20;const star=(Math.abs(gx)<2&&Math.abs(gy)<12)||(Math.abs(gy)<2&&Math.abs(gx)<12);a=star?.4:0;b=star?-.28:0;}
    const nz=1/Math.sqrt(a*a+b*b+1);normal.set([(a*nz*.5+.5)*255,(b*nz*.5+.5)*255,(nz*.5+.5)*255,255],i);
    const r=170+noise(x,y)*85;rough.set([r,r,r,255],i);
    const f=127+70*Math.sin(x/size*5+y/size*3)+35*Math.sin(y/size*11);film.set([f,f,f,255],i);
  }return {normal,rough,film,size};
}
function dataTexture(data,size){const t=new THREE.DataTexture(data,size,size);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;}
function physicalMaterial(def,s,w,h,frame=false){
  const g=grainData(def.finish),normal=dataTexture(g.normal,g.size),rough=dataTexture(g.rough,g.size),film=dataTexture(g.film,g.size);
  // Model units are metres. Printed surfaces use normalized UVs; extruded edges use geometry coordinates.
  for(const t of [normal,rough])t.repeat.set(frame?240:Math.max(.5,w/.025),frame?240:Math.max(.5,h/.025));
  const grain=(def.grain||.025)*.5*(frame?1:s.glitter/55);
  const mat=new THREE.MeshPhysicalMaterial({color:def.color,metalness:def.metalness,roughness:def.roughness,roughnessMap:rough,normalMap:normal,normalScale:new THREE.Vector2(grain,grain),iridescence:(def.iridescence||0)*(frame?1:s.glitter/100),iridescenceIOR:1.35,iridescenceThicknessRange:[120,480],iridescenceThicknessMap:film,anisotropy:def.anisotropy||0,anisotropyRotation:Math.PI/2,clearcoat:frame?.2:.08,clearcoatRoughness:.18,side:THREE.FrontSide});
  mat.userData.textures=[normal,rough,film];mat.userData.definition=def.id;
  if(!frame&&foilKind(def)){
    const yaw=s.lightAzimuth*Math.PI/180,elev=s.lightElevation*Math.PI/180;
    mat.userData.foilUniforms={uFoilSize:{value:new THREE.Vector2(w*1000,h*1000)},uFoilKind:{value:foilKind(def)},uFoilHolo:{value:def.iridescence>.5?1:0},uFoilStrength:{value:s.glitter/100},uFoilLight:{value:new THREE.Vector3(Math.sin(yaw)*Math.cos(elev),Math.sin(elev),Math.cos(yaw)*Math.cos(elev))},uFoilBrightness:{value:.15+s.keyLight/100*.7+s.environment/100*.15}};
    mat.onBeforeCompile=shader=>{Object.assign(shader.uniforms,mat.userData.foilUniforms);injectFoilShader(shader);};mat.customProgramCacheKey=()=>`foil-facets-v1`;
  }
  return mat;
}
export function injectFoilShader(shader,printed=false){
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vFoilUv;varying vec3 vFoilEye;').replace('#include <uv_vertex>','#include <uv_vertex>\nvFoilUv=uv;vFoilEye=cameraPosition-(modelMatrix*vec4(position,1.0)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec2 vFoilUv;varying vec3 vFoilEye;
uniform vec2 uFoilSize;uniform vec3 uFoilLight;
uniform float uFoilStrength,uFoilHolo,uFoilBrightness;uniform int uFoilKind;
float foilHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec4 foilOpticalResponse(){
  vec2 p=vec2(vFoilUv.x,1.0-vFoilUv.y)*uFoilSize;
  vec2 halfAngle=(normalize(vFoilEye).xy+uFoilLight.xy)*.5;
  float pitch=uFoilKind==4?2.8:.6;vec2 cell=floor(p/pitch),f=fract(p/pitch)-.5;
  float n=foilHash(cell),m=foilHash(cell+vec2(53.0,29.0));vec2 delta=halfAngle-(vec2(n,m)-.5)*1.25;
  float shape=uFoilKind==4?max(0.0,max(1.0-abs(f.x)*12.0-abs(f.y)*2.0,1.0-abs(f.y)*12.0-abs(f.x)*2.0)):max(0.0,1.0-length(f)*1.7);
  float sparkle=min(1.0,exp(-dot(delta,delta)/.009)*shape*2.8);
  float band=pow(.5+.5*cos(p.x*.24+halfAngle.x*18.0+halfAngle.y*4.0),10.0);
  float shade=.68+n*.1,glow=sparkle*1.8;
  if(uFoilKind==2){shade=.76+band*.17;glow=band*.3+sparkle*.6;}
  if(uFoilKind==3){shade=.8;glow=band*.15;}
  if(uFoilKind==5){shade=.91;glow=band*.14;}
  float hue=p.x*.035+p.y*.02+halfAngle.x*5.0+halfAngle.y*3.0;
  vec3 tint=(.5+.5*cos(vec3(hue)+vec3(0.0,2.094,4.189)))*.25*uFoilHolo;
  return vec4((tint+glow)*uFoilBrightness,shade);
}
`).replace('#include <opaque_fragment>',`
vec4 foilResponse=foilOpticalResponse();
float foilVisibility=uFoilStrength*${printed?'(1.0-printWhite)':'1.0'};
outgoingLight=outgoingLight*mix(1.0,foilResponse.a,foilVisibility)+foilResponse.rgb*foilVisibility${printed?'*mix(vec3(1.0),printInk.rgb,printAlpha)':''};
#include <opaque_fragment>`);
  return shader;
}
export function injectPrintShader(shader){
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vPrintUv;').replace('#include <uv_vertex>','#include <uv_vertex>\nvPrintUv = uv;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec2 vPrintUv;
uniform sampler2D uColorLayer;
uniform sampler2D uWhiteLayer;
uniform float uInkStrength;
uniform float uClearBase;
`)
  .replace('#include <color_fragment>',`#include <color_fragment>
vec4 printInk = texture2D(uColorLayer, vPrintUv);
float printWhite = texture2D(uWhiteLayer, vPrintUv).a;
float printAlpha = printInk.a * uInkStrength;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), printWhite) * mix(vec3(1.0), printInk.rgb, printAlpha);
if (uClearBase > 0.5) diffuseColor.a = max(printWhite, printAlpha * 0.72);
`)
  .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.64, printWhite);')
  .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - printWhite;')
  .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, printWhite));')
  .replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
#ifdef USE_IRIDESCENCE
material.iridescence *= 1.0 - printWhite;
#endif
#ifdef USE_ANISOTROPY
material.anisotropy *= 1.0 - printWhite;
material.alphaT = mix(material.alphaT, pow2(material.roughness), printWhite);
#endif
`);
  return shader;
}
function canvasTexture(c,color=false){const t=new THREE.CanvasTexture(c);if(color)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
export function laserMaterial(s,mask){
  if(!mask)throw new Error('Laser artwork requires a pattern mask');
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{
    uMask:{value:mask},uSize:{value:new THREE.Vector2(s.width,s.height)},uPitch:{value:s.filmPitch??16},uDirection:{value:(s.filmDirection??0)*Math.PI/180},
    uStructure:{value:['pillars','cross','facets','rings','omni'].indexOf(s.filmStructure??'pillars')},uOpaque:{value:s.filmPatternCoverage==='opaque'?1:0},uStrength:{value:s.filmOpacity/100},uLight:{value:(s.lightAzimuth??-18)*Math.PI/180},uBrightness:{value:1}
  },vertexShader:`varying vec2 vUv; varying vec3 vEye;
    void main(){vUv=uv;vec4 world=modelMatrix*vec4(position,1.0);vEye=cameraPosition-world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
  fragmentShader:`uniform sampler2D uMask;uniform float uPitch,uDirection,uStrength,uLight,uBrightness,uOpaque;uniform int uStructure;uniform vec2 uSize;varying vec2 vUv;varying vec3 vEye;
    void main(){
      vec2 p=(vec2(vUv.x,1.0-vUv.y)-.5)*uSize/uPitch;
      float x=p.x*cos(uDirection)+p.y*sin(uDirection),y=-p.x*sin(uDirection)+p.y*cos(uDirection);
      float domain=x,orientation=0.0;
      if(uStructure==1){domain=(x+y)*.7;orientation=sin(y*6.283)*.45;}
      if(uStructure==2){vec2 cell=floor(vec2(x,y));orientation=sin(cell.x*12.9898+cell.y*78.233)*2.0;domain=fract(x)*cos(orientation)+fract(y)*sin(orientation);}
      if(uStructure==3){domain=length(vec2(x,y));orientation=atan(y,x)*.3;}
      vec3 eye=normalize(vEye);float phase=domain*6.283+orientation+eye.x*9.0+eye.y*5.0+sin(uLight)*2.0;
      float band=pow(.5+.5*cos(phase),6.0);
      float hue=domain*.9+orientation+eye.x*6.0+eye.y*3.0+sin(uLight)*2.0;
      vec3 rgb=.5+.5*cos(vec3(hue)+vec3(0.0,2.094,4.189));
      if(uStructure==4){
        rgb=vec3(0.0);float weight=0.0;band=0.0;
        for(int j=0;j<8;j++){
          float direction=float(j)*.7853981634;vec2 dir=vec2(cos(direction),sin(direction));
          float d=dot(vec2(x,y),dir),e=dot(eye.xy,dir),illum=sin(uLight-direction);
          float glow=pow(.5+.5*cos(d*6.283+e*9.0+illum*2.0+float(j)*.7),8.0),w=.015+glow;
          float tint=d*.9+e*6.0+illum*2.0+direction;
          rgb+=(.5+.5*cos(vec3(tint)+vec3(0.0,2.094,4.189)))*w;weight+=w;band=max(band,glow);
        }
        rgb=clamp(.5+(rgb/weight-.5)*1.8,0.0,1.0);
      }
      float alpha=mix(uStrength*(.55+band*.35),1.0,uOpaque)*texture2D(uMask,vUv).a;
      if(uOpaque>.5)rgb=mix(vec3(.72,.74,.78),rgb,uStrength);
      gl_FragColor=vec4(pow(rgb,vec3(2.2))*uBrightness,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  mat.userData.laser=true;mat.userData.textures=mask?[mask]:[];return mat;
}
export function frameGeometry(w,h,t,edge){
  const e=Math.min(edge,Math.min(w,h)*.22),shape=new THREE.Shape();
  shape.moveTo(-w/2,-h/2);shape.lineTo(w/2,-h/2);shape.lineTo(w/2,h/2);shape.lineTo(-w/2,h/2);shape.closePath();
  const hole=new THREE.Path();hole.moveTo(-w/2+e,-h/2+e);hole.lineTo(-w/2+e,h/2-e);hole.lineTo(w/2-e,h/2-e);hole.lineTo(w/2-e,-h/2+e);hole.closePath();shape.holes.push(hole);
  const geo=new THREE.ExtrudeGeometry(shape,{depth:t,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:Math.min(.0001,e/4),bevelThickness:.00012,curveSegments:1});geo.translate(0,0,-t/2);return geo;
}
function mesh(geo,mat,name,z=0){const obj=new THREE.Mesh(geo,mat);obj.name=name;obj.position.z=z;return obj;}
function label(text,w=.055){const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='#716876';let font=64;ctx.font=`${font}px "Microsoft YaHei", sans-serif`;font=Math.min(font,font*470/Math.max(1,ctx.measureText(text).width));ctx.font=`${font}px "Microsoft YaHei", sans-serif`;ctx.textAlign='center';ctx.fillText(text,256,69);const tex=canvasTexture(c,true),mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false});mat.userData.textures=[tex];const sprite=new THREE.Sprite(mat);sprite.scale.set(w,w*96/512,1);sprite.name='dimension-label';return sprite;}
export function createProduct(s,art,mask,patterns={}){
  const root=new THREE.Group();root.name='acrylic-product';const w=s.width/1000,h=s.height/1000,t=s.thickness/1000;
  root.userData.dimensions={width:w,height:h,thickness:t};
  const hasBacking=s.backing!=='none',bt=hasBacking?(s.backingThickness??1)/1000:0;
  root.userData.dimensions.backingThickness=bt;
  const def=hasBacking?(baseById[s.base]||baseById['brush-holo']):baseById.clear,edgeDef=edgeById[s.edge]||edgeById['sand-champagne'];
  const p=planes(s,art,mask,1024),colorTexture=canvasTexture(p.color,true),whiteTexture=canvasTexture(p.white);
  const surface=physicalMaterial(def,s,w,h);surface.userData.textures.push(colorTexture,whiteTexture);
  const transparent=!hasBacking;surface.transparent=transparent;surface.depthWrite=!transparent;
  surface.side=transparent?THREE.DoubleSide:THREE.FrontSide;
  surface.customProgramCacheKey=()=>`acrylic-print-v4-${transparent}`;
  surface.onBeforeCompile=shader=>{Object.assign(shader.uniforms,{uColorLayer:{value:colorTexture},uWhiteLayer:{value:whiteTexture},uInkStrength:{value:s.inkOpacity/100},uClearBase:{value:transparent?1:0}});injectPrintShader(shader);if(surface.userData.foilUniforms){Object.assign(shader.uniforms,surface.userData.foilUniforms);injectFoilShader(shader,true);}};
  const printed=mesh(new THREE.PlaneGeometry(w,h),surface,'printed-surface',-t/2+.00005);printed.renderOrder=1;root.add(printed);
  // The opaque paper core separates the inward foil from the outward rear print.
  const backing=new THREE.Group();backing.name='backing';backing.position.z=-t/2-.00008;backing.visible=hasBacking;root.add(backing);
  if(hasBacking){
    const core=mesh(new THREE.BoxGeometry(w,h,bt),new THREE.MeshStandardMaterial({color:'#d7cfc0',roughness:.95}),'cardboard-core',-bt/2);backing.add(core);
    const foil=mesh(new THREE.PlaneGeometry(w,h),physicalMaterial(def,s,w,h),'inward-foil',.00001);backing.add(foil);
    const rearTexture=canvasTexture(paperBackCanvas(s,p.w,p.h,patterns.bottom),true);
    const rearMat=new THREE.MeshStandardMaterial({map:rearTexture,roughness:.92,metalness:0});rearMat.userData.textures=[rearTexture];
    const rear=mesh(new THREE.PlaneGeometry(w,h),rearMat,'outward-pattern',-bt-.00001);rear.rotation.y=Math.PI;backing.add(rear);
  }else{
    // Viewed from behind, white ink lies in front of the color layer and masks it.
    const reverseWhite=mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:whiteTexture,transparent:true,depthWrite:false}),'rear-white-ink',-t/2-.00003);reverseWhite.rotation.y=Math.PI;
    // UVs must still align with the front artwork after turning the plane around.
    const uv=reverseWhite.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));
    reverseWhite.renderOrder=3;root.add(reverseWhite);
  }
  // Thin alpha shell keeps transparent print visible: Three's transmission buffer excludes blended ink.
  const glassMat=new THREE.MeshPhysicalMaterial({color:'#ffffff',metalness:0,roughness:0,transmission:hasBacking?1:0,transparent:!hasBacking,opacity:hasBacking?1:.055,depthWrite:hasBacking,ior:1.49,thickness:t,attenuationColor:'#f7fcfb',attenuationDistance:2,clearcoat:.15,clearcoatRoughness:.025,envMapIntensity:.12+s.light/100*.28});
  const glass=mesh(new THREE.BoxGeometry(w,h,t),glassMat,'acrylic-volume');glass.renderOrder=2;root.add(glass);
  const hasFilm=s.film&&s.film!=='none';
  if(hasFilm){
    const strength=(s.filmStrength??45)/100;
    if(s.film==='matte')glassMat.roughness=.025+strength*.055;
    const filmMat=new THREE.MeshPhysicalMaterial({color:'#ffffff',transparent:true,opacity:s.film==='matte'?.025+strength*.04:.012+strength*.025,roughness:s.film==='matte'?.55:.13,metalness:0,clearcoat:s.film==='gloss'?1:.25,clearcoatRoughness:.06,depthWrite:false,side:THREE.DoubleSide});
    const film=mesh(new THREE.PlaneGeometry(w,h),filmMat,'top-film',t/2+.00015);film.renderOrder=5;root.add(film);
    const pattern=decorationCanvas(s.filmPatternFinish==='laser'?{...s,filmOpacity:100}:s,'film',p.w,p.h,patterns.film),tex=canvasTexture(pattern,true);
    const mat=new THREE.MeshPhysicalMaterial({map:tex,color:'#ffffff',metalness:.55,roughness:.32,transparent:true,alphaTest:.008,depthWrite:false,side:THREE.DoubleSide,iridescence:s.filmColor==='holo'?.8:0,iridescenceThicknessRange:[180,400]});mat.userData.textures=[tex];
    const patternMat=s.filmPatternFinish==='laser'?laserMaterial(s,tex):mat;if(s.filmPatternFinish==='laser')mat.dispose();
    const decoration=mesh(new THREE.PlaneGeometry(w,h),patternMat,'film-pattern',t/2+.0002);decoration.renderOrder=6;root.add(decoration);
  }
  if(s.edge!=='none'&&s.edgeWidth>0){const frame=mesh(frameGeometry(w,h,t+bt+.0002,s.edgeWidth/1000),physicalMaterial(edgeDef,s,w,h,true),'edge-wrap',-bt/2);root.add(frame);}
  if(s.view==='layers'){
    const gap=.012+s.explode/100*.05;printed.visible=false;
    backing.position.z=-gap;
    const reverseWhite=root.getObjectByName('rear-white-ink');if(reverseWhite)reverseWhite.visible=false;
    const wm=new THREE.MeshBasicMaterial({map:whiteTexture,transparent:true,side:THREE.DoubleSide,depthWrite:false});const whitePlane=mesh(new THREE.PlaneGeometry(w,h),wm,'exploded-white',0);whitePlane.renderOrder=3;root.add(whitePlane);
    const cm=new THREE.MeshBasicMaterial({map:colorTexture,transparent:true,opacity:s.inkOpacity/100,side:THREE.DoubleSide,depthWrite:false});const colorPlane=mesh(new THREE.PlaneGeometry(w,h),cm,'exploded-color',gap);colorPlane.renderOrder=4;root.add(colorPlane);glass.position.z=gap*2;
    const frame=root.getObjectByName('edge-wrap');if(frame)frame.position.z=gap*2;
    glassMat.transmission=0;glassMat.transparent=true;glassMat.opacity=.07;glassMat.depthWrite=false;
    if(hasFilm){root.getObjectByName('top-film').position.z=gap*3;root.getObjectByName('film-pattern').position.z=gap*3+.0001;const tag=label('覆膜 / 膜纹',.046);tag.position.set(0,h/2+.014,gap*3);root.add(tag);}
    [...(hasBacking?[['纸板 / 内闪底',-gap]]:[]),['白墨',0],['彩层',gap],['亚克力',gap*2]].forEach(([text,z])=>{const l=label(text,.034);l.position.set(0,h/2+.014,z);root.add(l);});
  }else if(s.view==='white'||s.view==='color'){
    root.children.forEach(c=>c.visible=false);
    const plate=mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:s.view==='white'?whiteTexture:colorTexture,transparent:true,side:THREE.DoubleSide,depthWrite:false}),'layer-inspection');root.add(plate);
  }
  return root;
}
export function disposeProduct(root){if(!root)return;const mats=new Set(),textures=new Set();root.traverse(obj=>{obj.geometry?.dispose();for(const m of (Array.isArray(obj.material)?obj.material:[obj.material]))if(m)mats.add(m);});for(const mat of mats){for(const t of mat.userData.textures||[])textures.add(t);for(const value of Object.values(mat))if(value?.isTexture)textures.add(value);mat.dispose();}textures.forEach(t=>t.dispose());}
