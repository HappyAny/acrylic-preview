import {imageRect,maskCoverage} from './model.js';
import {edgeMaterials,baseMaterials,edgeById,baseById,foilOptics,foilResponse} from './materials.js';
import {paperBackCanvas,filmOverlay,filmNames,patternNames} from './decoration.js';
export const labels={edge:Object.fromEntries(edgeMaterials.map(m=>[m.id,m.label])),base:Object.fromEntries(baseMaterials.map(m=>[m.id,m.label])),whiteMode:{auto:'跟随彩层',upload:'独立白墨图',full:'满版白墨',none:'无白墨'}};
export function summary(s){return `${s.backing==='none'?'无底板':`纸板 · ${labels.base[s.base]}`} / ${labels.edge[s.edge]}${s.edge==='none'?'':'边'} / ${s.width} × ${s.height} mm`;}
const makeCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
let cachedKey='',cachedPlanes;
export function planes(s,art,mask,max=680){
  const w=Math.max(1,Math.round(max*Math.min(1,s.width/s.height))),h=Math.max(1,Math.round(max*Math.min(1,s.height/s.width)));
  const key=[w,h,s.fit,s.scale,s.offsetX,s.offsetY,s.whiteMode,s.maskMode,s.whiteOpacity,art?.src,mask?.src].join('|');
  if(key===cachedKey) return cachedPlanes;
  const color=makeCanvas(w,h),cc=color.getContext('2d',{willReadFrequently:true});
  const rect=art?imageRect(art.naturalWidth,art.naturalHeight,w,h,s):[0,0,w,h];
  if(art) cc.drawImage(art,...rect);
  const pixels=cc.getImageData(0,0,w,h),white=makeCanvas(w,h),wc=white.getContext('2d',{willReadFrequently:true}),whiteData=wc.createImageData(w,h);
  let mp;
  if(s.whiteMode==='upload' && mask){wc.drawImage(mask,...rect);mp=wc.getImageData(0,0,w,h).data;wc.clearRect(0,0,w,h);}
  for(let p=0;p<pixels.data.length;p+=4){
    let v=s.whiteMode==='full'?1:s.whiteMode==='auto'?pixels.data[p+3]/255:s.whiteMode==='upload'&&mp?maskCoverage(mp[p],mp[p+1],mp[p+2],mp[p+3],s.maskMode):0;
    whiteData.data[p]=whiteData.data[p+1]=whiteData.data[p+2]=255;whiteData.data[p+3]=Math.round(v*s.whiteOpacity/100*255);
  }
  wc.putImageData(whiteData,0,0);
  cachedKey=key;cachedPlanes={w,h,color,white,pixels:pixels.data,mask:whiteData.data};return cachedPlanes;
}
function hash(x,y){let n=Math.imul(x+81,374761393)+Math.imul(y+113,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
export function backgroundAt(s,x,y){
  if(s.background==='dark') return [49,55,60];
  if(s.background==='check') return ((Math.floor(x/22)+Math.floor(y/22))%2)?[222,220,216]:[247,246,242];
  return [238,235,226];
}
export function surface(s,p){
  const c=makeCanvas(p.w,p.h),ctx=c.getContext('2d'),out=ctx.createImageData(p.w,p.h),d=out.data,ink=p.pixels,mask=p.mask;
  const def=baseById[s.base]||baseById['brush-holo'],rgb=def.color.slice(1).match(/../g).map(v=>parseInt(v,16));
  const strength=s.glitter/100,phase=s.angleY/25+s.angleX/30;
  const optics=foilOptics(s,def);
  for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++){
    const i=(y*p.w+x)*4,noise=hash(x,y),wave=x/p.w*5+y/p.h*4+phase*2;
    let base;
    if(s.backing==='none') base=backgroundAt(s,x*1.25,y*1.25);
    else if(def.finish==='clear') base=[238,232,222];
    else if(def.iridescence>.5&&def.finish!=='stars') base=[0,1,2].map(k=>231+Math.sin(wave+k*2.1)*22*strength+(noise-.5)*10*strength);
    else if(def.finish==='glitter'){const n=(noise-.5)*45*strength;base=rgb.map(v=>v*.45+140+n);}
    else if(def.finish==='stars'){const n=(noise-.5)*12*strength;base=[224+n,228+n,239+n];const gx=x%42-21,gy=y%42-21;const gleam=Math.max(0,1-Math.abs(gx)/3-Math.abs(gy)/14,1-Math.abs(gx)/14-Math.abs(gy)/3);base=base.map(v=>v+(255-v)*gleam*strength);}
    else if(def.finish==='brushed'){const n=(hash(x,0)-.5)*18*strength;base=rgb.map(v=>v*.45+140+n);}
    else base=[243+Math.sin(wave)*7*strength,240+Math.cos(wave)*7*strength,237+Math.sin(wave+1)*10*strength];
    const white=mask[i+3]/255,alpha=ink[i+3]/255*s.inkOpacity/100;
    if(s.backing!=='none'&&optics.kind&&white<1&&strength>0){const response=foilResponse(optics,x/p.w*s.width,y/p.h*s.height);base=base.map((v,k)=>v*response[0]+255*response[k+1]);}
    for(let k=0;k<3;k++){const under=base[k]*(1-white)+255*white;d[i+k]=s.view==='back'&&s.backing==='none'?base[k]*(1-alpha*(1-ink[i+k]/255))*(1-white)+255*white:under*(1-alpha*(1-ink[i+k]/255));}d[i+3]=255;
  }
  ctx.putImageData(out,0,0);return c;
}
function round(ctx,x,y,w,h,r=5){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function checker(ctx,x,y,w,h,size=15){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.fillStyle='#f7f6f2';ctx.fillRect(x,y,w,h);ctx.fillStyle='#dfdcd6';for(let row=0;row<h/size;row++)for(let col=0;col<w/size;col++)if((row+col)%2)ctx.fillRect(x+col*size,y+row*size,size,size);ctx.restore();}
function product(ctx,s,p,x,y,w,h,patterns={}){
  const border=s.edge==='none'?0:s.edgeWidth/s.width*w,depth=(s.thickness+(s.backing==='none'?0:s.backingThickness??1))/s.width*w;
  ctx.save();ctx.translate(x+w/2,y+h/2);ctx.transform(1-Math.abs(s.angleY)/240,s.angleX/480,-s.angleY/300,1-Math.abs(s.angleX)/220,0,0);x=-w/2;y=-h/2;
  ctx.shadowColor='#51473535';ctx.shadowBlur=34;ctx.shadowOffsetX=10;ctx.shadowOffsetY=26;
  round(ctx,x+depth*.6,y+depth*.8,w,h,4);ctx.fillStyle=s.edge==='black'?'#353434':'#c1beb15c';ctx.fill();ctx.shadowColor='transparent';
  ctx.save();round(ctx,x,y,w,h,3);ctx.clip();if(s.view==='back'&&s.backing!=='none')ctx.drawImage(paperBackCanvas(s,p.w,p.h,patterns.bottom),x,y,w,h);
  else if(s.view==='back'){ctx.save();ctx.translate(x+w,y);ctx.scale(-1,1);ctx.drawImage(surface(s,p),0,0,w,h);ctx.restore();}
  else ctx.drawImage(surface(s,p),x,y,w,h);
  if(s.view!=='back'&&s.film&&s.film!=='none')ctx.drawImage(filmOverlay(s,p.w,p.h,patterns.film),x,y,w,h);
  const gl=ctx.createLinearGradient(x,y+h,x+w,y);gl.addColorStop(0,'#ffffff00');gl.addColorStop(.35,'#ffffff00');gl.addColorStop(.55,`rgba(255,255,255,${s.view==='back'&&s.backing!=='none'?0:s.light/100*.23})`);gl.addColorStop(.65,'#ffffff00');gl.addColorStop(1,`rgba(255,255,255,${s.view==='back'&&s.backing!=='none'?0:s.light/100*.07})`);ctx.fillStyle=gl;ctx.fillRect(x,y,w,h);ctx.restore();
  const edgeColors={gold:['#a68c51','#f9e8b5','#b49a60','#f2dfab'],silver:['#929da6','#fbfcfc','#a5afb9','#f5f6f8'],rose:['#b47c76','#f5d7c7','#c78f82','#ffe5d9'],white:['#e1ded7','#fffef8','#e4dfd4','#fffef9'],black:['#242728','#5e6162','#252829','#6e7070'],none:['#ffffff99','#ffffff99','#999d9c55','#ffffff99']};
  const def=edgeById[s.edge],baseRGB=(def?.color||'#cccccc').slice(1).match(/../g).map(v=>parseInt(v,16));
  const tint=t=>`rgb(${baseRGB.map(v=>Math.round(t>=0?v+(255-v)*t:v*(1+t))).join(',')})`;
  const palette=def?.finish==='holo'?['#bedcd7','#e5c8df','#e9ddb3','#bed0e3']:def?.finish==='mirror'?[tint(-.45),tint(.45),tint(-.2),tint(.25)]:def&&!def.legacy?[tint(-.13),tint(.25),tint(-.08),tint(.14)]:edgeColors[s.edge];
  const metal=ctx.createLinearGradient(x,y,x+w,y+h);(palette||edgeColors.none).forEach((v,i)=>metal.addColorStop(i/3,v));ctx.strokeStyle=metal;ctx.lineWidth=Math.max(1.3,border);round(ctx,x+border/2,y+border/2,w-border,h-border,2);ctx.stroke();
  if(def?.finish==='sand'&&border>0){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.rect(x+border,y+border,w-2*border,h-2*border);ctx.clip('evenodd');for(let i=0;i<1800;i++){const along=hash(i,8)*2*(w+h),across=hash(i,17)*border;let xx,yy;if(along<w){xx=x+along;yy=y+across;}else if(along<w+h){xx=x+w-across;yy=y+along-w;}else if(along<2*w+h){xx=x+along-w-h;yy=y+h-across;}else{xx=x+across;yy=y+along-2*w-h;}ctx.fillStyle=i%2?'#ffffff45':'#00000012';ctx.fillRect(xx,yy,.8,1.6);}ctx.restore();}
  ctx.strokeStyle='#ffffff70';ctx.lineWidth=.7;round(ctx,x+1,y+1,w-2,h-2,3);ctx.stroke();ctx.restore();
}
export function drawScene(canvas,s,art,mask,{caption=false,comparison=null,patterns={}}={}){
  const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;
  ctx.clearRect(0,0,W,H);const dark=s.background==='dark';ctx.fillStyle=dark?'#343a3e':'#efede6';ctx.fillRect(0,0,W,H);
  if(s.background==='check')checker(ctx,0,0,W,H,24);
  else{const glow=ctx.createRadialGradient(W*.4,H*.28,1,W*.5,H*.5,W*.7);glow.addColorStop(0,dark?'#535b60':'#faf9f4');glow.addColorStop(1,dark?'#2d3236':'#e5e1d7');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);}
  const p=planes(s,art,mask),top=H*(caption?.055:.05),maxW=W*(s.view==='layers'?.65:caption?.86:.9),maxH=H*(s.view==='layers'?.76:caption?.78:.9),ratio=s.width/s.height,h=Math.min(maxH,maxW/ratio),w=h*ratio,x=(W-w)/2,y=top+(maxH-h)/2;
  if(s.view==='layers'){
    const lw=w*.67,lh=h*.67,xx=(W-lw)/2,yy=(H-lh)/2;
    const layers=[...(s.backing==='none'?[]:[['纸板内侧 · 闪底',surface({...s,whiteOpacity:0,inkOpacity:0},{...p,mask:new Uint8ClampedArray(p.mask.length)})]]),['白墨',p.white],['彩层',p.color]];
    if(s.film&&s.film!=='none')layers.push(['覆膜与花纹',filmOverlay(s,p.w,p.h,patterns.film)]);
    layers.forEach(([name,c],i)=>{const lx=xx+(i-1)*W*.09,ly=yy-(i-1)*H*.09;ctx.save();ctx.shadowColor='#51473520';ctx.shadowBlur=22;checker(ctx,lx,ly,lw,lh);ctx.drawImage(c,lx,ly,lw,lh);ctx.shadowColor='transparent';ctx.strokeStyle='#aea5b580';ctx.strokeRect(lx,ly,lw,lh);ctx.fillStyle=dark?'#f8f7f3':'#79717f';ctx.font=`${W*.017}px sans-serif`;ctx.fillText(`${i+1}  ${name}`,lx+lw+12,ly+20);ctx.restore();});
  }else if(s.view==='color'||s.view==='white'){
    checker(ctx,x,y,w,h);ctx.drawImage(s.view==='color'?p.color:p.white,x,y,w,h);ctx.strokeStyle='#bcb4c2';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);
  }else product(ctx,s,p,x,y,w,h,patterns);
  if(comparison && s.view==='finished'){
    const temp=makeCanvas(W,H);drawScene(temp,comparison.state,comparison.art,comparison.mask,{patterns:comparison.patterns||{}});ctx.save();ctx.beginPath();ctx.rect(0,0,W/2,H);ctx.clip();ctx.drawImage(temp,0,0);ctx.restore();ctx.strokeStyle='#ffffffcc';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(W/2,H*.11);ctx.lineTo(W/2,H*.89);ctx.stroke();ctx.font=`${W*.014}px sans-serif`;ctx.fillStyle=dark?'#fff':'#7b7184';ctx.fillText('A · 已固定',W*.15,H*.88);ctx.fillText('B · 当前搭配',W*.69,H*.88);
  }
  if(caption&&s.view!=='layers'){
    ctx.strokeStyle=dark?'#91999b':'#b6ada0';ctx.fillStyle=dark?'#c2c9c9':'#a49a8d';ctx.lineWidth=1;
    const dy=y+h+H*.035;ctx.beginPath();ctx.moveTo(x,dy);ctx.lineTo(x+w,dy);ctx.moveTo(x,dy-4);ctx.lineTo(x,dy+4);ctx.moveTo(x+w,dy-4);ctx.lineTo(x+w,dy+4);ctx.stroke();ctx.textAlign='center';ctx.font=`${W*.017}px sans-serif`;ctx.fillText(`${s.width} mm`,W/2,dy+H*.027);ctx.save();ctx.translate(x+w+W*.043,y+h/2);ctx.rotate(-Math.PI/2);ctx.fillText(`${s.height} mm`,0,0);ctx.restore();ctx.textAlign='left';
  }
  if(caption){ctx.fillStyle=dark?'#eef0eb':'#625c69';ctx.textAlign='center';ctx.font=`${W*.02}px sans-serif`;ctx.fillText('透色  /  '+(s.view==='back'?'背面 · ':'')+summary(s),W/2,H*.936);ctx.font=`${W*.014}px sans-serif`;ctx.fillText(`${labels.whiteMode[s.whiteMode]} ${s.whiteOpacity}% · ${filmNames[s.film]||'不覆膜'} · 底纹：${s.backing==='none'?'无底板':patternNames[s.bottomPattern]||'无'} · 膜纹：${patternNames[s.filmPattern]||'无'}`,W/2,H*.964);ctx.font=`${W*.012}px sans-serif`;ctx.fillText('材质近似预览，以实物打样为准',W/2,H*.987);ctx.textAlign='left';}
}
