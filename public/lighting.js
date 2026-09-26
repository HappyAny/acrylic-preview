import * as THREE from 'three';

// A continuous neutral light tent: no visible floor, hard card edges or dark camera hole.
// The broad forward lobe is intentional: flat metal must look good from the front.
export function studioRadiance(direction,s){
  const [x,y,z]=direction,yaw=THREE.MathUtils.degToRad(s.lightAzimuth),elev=THREE.MathUtils.degToRad(s.lightElevation);
  const key=[Math.sin(yaw)*Math.cos(elev),Math.sin(elev),Math.cos(yaw)*Math.cos(elev)];
  const dot=key[0]*x+key[1]*y+key[2]*z;
  const front=Math.exp((z-1)*2.3),softKey=Math.exp((dot-1)*6),fill=Math.exp(((.55*x-.06*y+.833*z)-1)*5);
  const rim=Math.exp(((.6*x+.3*y-.742*z)-1)*9);
  const value=.55+.85*front+s.keyLight/100*.8*softKey+s.fillLight/100*.55*fill+s.rimLight/100*.65*rim;
  return [value,value*.998,value*.993];
}
export function studioEnvironmentTexture(s,width=512,height=256){
  const data=new Float32Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const theta=(y+.5)/height*Math.PI,phi=((x+.5)/width-.5)*Math.PI*2;
    const dir=[Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi)];
    const rgb=studioRadiance(dir,s),i=(y*width+x)*4;data.set([...rgb,1],i);
  }
  const tex=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);tex.mapping=THREE.EquirectangularReflectionMapping;tex.colorSpace=THREE.LinearSRGBColorSpace;tex.needsUpdate=true;return tex;
}
