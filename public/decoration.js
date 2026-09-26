export const patternNames={flecks:'白纸洒金碎点',none:'无花纹',stars:'星芒',hearts:'爱心',dots:'细点',diamonds:'菱晶',lines:'斜纹',custom:'上传图案'};
export const patternColors={silver:'#f3f5f7',gold:'#e2c177',pink:'#ecaccb',white:'#ffffff',holo:'#c8e0f1'};
export const filmNames={none:'不覆膜',gloss:'高透亮膜',matte:'细哑膜'};
// Artistic diffraction approximation. Pitch denotes visible embossing domains, not nanometre grooves.
export function laserSample(s,u,v,viewX=0,viewY=0){
  const a=(s.filmDirection??0)*Math.PI/180,pitch=s.filmPitch??16;
  const px=(u-.5)*s.width/pitch,py=(v-.5)*s.height/pitch;
  const x=px*Math.cos(a)+py*Math.sin(a),y=-px*Math.sin(a)+py*Math.cos(a);
  let domain=x,orientation=0;
  if(s.filmStructure==='cross'){domain=(x+y)*.7;orientation=Math.sin(y*6.283)*.45;}
  if(s.filmStructure==='rings'){domain=Math.hypot(x,y);orientation=Math.atan2(y,x)*.3;}
  if(s.filmStructure==='facets'){const ix=Math.floor(x),iy=Math.floor(y);orientation=Math.sin(ix*12.9898+iy*78.233)*2;domain=(x-ix)*Math.cos(orientation)+(y-iy)*Math.sin(orientation);}
  const light=(s.lightAzimuth??-18)*Math.PI/180,phase=domain*6.283+orientation+viewX*9+viewY*5+Math.sin(light)*2;
  let band=Math.pow(.5+.5*Math.cos(phase),6);
  const hue=domain*.9+orientation+viewX*6+viewY*3+Math.sin(light)*2;
  let rgb=[0,2.094,4.189].map(o=>.5+.5*Math.cos(hue+o));
  if(s.filmStructure==='omni'){
    rgb=[0,0,0];let weight=0;band=0;
    for(let j=0;j<8;j++){
      const direction=j*Math.PI/4,dx=Math.cos(direction),dy=Math.sin(direction);
      const d=x*dx+y*dy,eye=viewX*dx+viewY*dy,illum=Math.sin(light-direction);
      const glow=Math.pow(.5+.5*Math.cos(d*6.283+eye*9+illum*2+j*.7),8),w=.015+glow;
      const tint=d*.9+eye*6+illum*2+direction;
      [0,2.094,4.189].forEach((offset,k)=>rgb[k]+=(.5+.5*Math.cos(tint+offset))*w);
      weight+=w;band=Math.max(band,glow);
    }
    rgb=rgb.map(v=>Math.max(0,Math.min(1,.5+(v/weight-.5)*1.8)));
  }
  const strength=(s.filmOpacity??40)/100;
  if(s.filmPatternCoverage==='opaque')return [...rgb.map((v,k)=>[.72,.74,.78][k]*(1-strength)+v*strength),1];
  return [...rgb,strength*(.55+band*.35)];
}
export function laserCanvas(s,w,h,mask=null){
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d'),data=ctx.createImageData(w,h);
  if(!mask)return c;
  const alpha=mask.getContext('2d').getImageData(0,0,w,h).data;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(!alpha[i+3])continue;const p=laserSample(s,x/w,y/h,(s.angleY??0)/30,(s.angleX??0)/30);for(let k=0;k<3;k++)data.data[i+k]=p[k]*255;data.data[i+3]=p[3]*alpha[i+3];}
  ctx.putImageData(data,0,0);return c;
}
// Rear artwork is printed on opaque paper, never on the inward-facing foil.
export function paperBackCanvas(s,w,h,image=null){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');ctx.fillStyle=s.bottomPattern==='flecks'?'#f5f3ed':'#eee8de';ctx.fillRect(0,0,w,h);
  ctx.drawImage(decorationCanvas(s,'bottom',w,h,image),0,0);return c;
}
export function decorationCanvas(s,slot,w,h,image=null){
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');
  const pattern=s[slot+'Pattern']||'none',opacity=(s[slot+'Opacity']??50)/100,color=s[slot+'Color']||'silver';
  if(pattern==='none'||(slot==='film'&&s.film==='none'))return c;
  ctx.globalAlpha=slot==='film'&&s.filmPatternCoverage==='opaque'?1:opacity;
  if(pattern==='custom'){
    if(image){
      const k=Math.min(w/image.naturalWidth,h/image.naturalHeight);ctx.drawImage(image,(w-image.naturalWidth*k)/2,(h-image.naturalHeight*k)/2,image.naturalWidth*k,image.naturalHeight*k);
      if(slot==='film'&&s.filmMaskMode==='light'){
        const data=ctx.getImageData(0,0,w,h);
        for(let i=0;i<data.data.length;i+=4){const d=data.data;d[i+3]*=(.2126*d[i]+.7152*d[i+1]+.0722*d[i+2])/255;d[i]=d[i+1]=d[i+2]=255;}
        ctx.putImageData(data,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-in';
        let tint=patternColors[color]||patternColors.silver;
        if(color==='holo'){tint=ctx.createLinearGradient(0,0,w,h);['#a7ded9','#f2c4e7','#f7e4a6','#b5cef0'].forEach((v,i)=>tint.addColorStop(i/3,v));}
        ctx.fillStyle=tint;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='source-over';
      }
    }return c;
  }
  let paint=patternColors[color]||patternColors.silver;
  if(color==='holo'){paint=ctx.createLinearGradient(0,0,w,h);['#a7ded9','#f2c4e7','#f7e4a6','#b5cef0','#b9e0cc'].forEach((v,i)=>paint.addColorStop(i/4,v));}
  ctx.fillStyle=paint;ctx.strokeStyle=paint;
  const tile=Math.max(8,(s[slot+'Size']||12)/s.width*w),r=tile*.19;
  if(pattern==='flecks'){
    // Fixed seed: the printed paper stays identical through redraws and camera changes.
    let seed=73129;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const count=Math.ceil(w*h/(tile*tile)*1.45);
    for(let i=0;i<count;i++){
      const x=random()*w,y=random()*h,radius=tile*(.014+random()*.045),stretch=.5+random(),turn=random()*Math.PI;
      ctx.save();ctx.translate(x,y);ctx.rotate(turn);ctx.scale(1,stretch);
      ctx.globalAlpha=opacity*(.3+random()*.55);
      ctx.fillStyle=color==='gold'?['#b88959','#c5a16b','#d3b583','#aa7854'][Math.floor(random()*4)]:paint;
      ctx.beginPath();
      for(let j=0;j<9;j++){const a=j*Math.PI*2/9,r=radius*(.4+random()*.6);if(j===0)ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);else ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
      ctx.closePath();ctx.fill();ctx.restore();
    }
    return c;
  }
  if(pattern==='lines'){ctx.lineWidth=Math.max(1,tile*.025);for(let x=-h;x<w+h;x+=tile){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+h,h);ctx.stroke();}return c;}
  for(let row=-1;row<h/tile+1;row++)for(let col=-1;col<w/tile+1;col++){
    const x=(col+.5+(row%2)*.5)*tile,y=(row+.5)*tile;ctx.save();ctx.translate(x,y);ctx.beginPath();
    if(pattern==='stars'){ctx.moveTo(0,-r);ctx.quadraticCurveTo(r*.15,-r*.15,r,0);ctx.quadraticCurveTo(r*.15,r*.15,0,r);ctx.quadraticCurveTo(-r*.15,r*.15,-r,0);ctx.quadraticCurveTo(-r*.15,-r*.15,0,-r);}
    else if(pattern==='hearts'){ctx.moveTo(0,r);ctx.bezierCurveTo(-r*2,-r*.25,-r*.8,-r*1.6,0,-r*.55);ctx.bezierCurveTo(r*.8,-r*1.6,r*2,-r*.25,0,r);}
    else if(pattern==='diamonds'){ctx.moveTo(0,-r);ctx.lineTo(r*.65,0);ctx.lineTo(0,r);ctx.lineTo(-r*.65,0);ctx.closePath();}
    else ctx.arc(0,0,r*.32,0,Math.PI*2);
    ctx.fill();ctx.restore();
  }return c;
}
export function filmPatternTemplate(s,image=null,max=1800){
  const w=Math.max(1,Math.round(max*Math.min(1,s.width/s.height))),h=Math.max(1,Math.round(max*Math.min(1,s.height/s.width)));
  const c=decorationCanvas({...s,film:'gloss',filmOpacity:100,filmPatternCoverage:'opaque'},'film',w,h,image),ctx=c.getContext('2d'),data=ctx.getImageData(0,0,w,h);
  for(let i=0;i<data.data.length;i+=4){const value=data.data[i+3];data.data[i]=data.data[i+1]=data.data[i+2]=value;data.data[i+3]=255;}
  ctx.putImageData(data,0,0);return c;
}
export function filmOverlay(s,w,h,image=null){
  let c=decorationCanvas(s,'film',w,h,image);if(s.film==='none')return c;
  if(s.filmPatternFinish==='laser'&&s.filmPattern!=='none')c=laserCanvas(s,w,h,decorationCanvas({...s,filmOpacity:100},'film',w,h,image));
  const ctx=c.getContext('2d');
  ctx.save();ctx.globalCompositeOperation='destination-over';
  const alpha=(s.filmStrength??45)/100;
  if(s.film==='matte'){ctx.fillStyle=`rgba(247,247,245,${alpha*.12})`;ctx.fillRect(0,0,w,h);}
  else{const g=ctx.createLinearGradient(-w*.15,0,w,h);g.addColorStop(0,'#ffffff00');g.addColorStop(.34,'#ffffff00');g.addColorStop(.47,`rgba(255,255,255,${alpha*.22})`);g.addColorStop(.6,'#ffffff00');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  }
  ctx.restore();return c;
}
