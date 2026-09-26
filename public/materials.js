// Names transcribed from the two supplied shop swatches. Values are visual approximations, not measurements.
const sand=(id,label,color)=>({id,label,color,finish:'sand',roughness:.34,metalness:.86,grain:.36});
export const edgeMaterials=[
  sand('sand-gold','流沙金色','#b6a335'),sand('sand-silver','流沙银色','#b7c0c0'),sand('sand-black','流沙黑色','#1d1b25'),sand('sand-pink','流沙粉色','#af79a1'),
  sand('sand-royal','流沙宝蓝','#195978'),sand('sand-navy','流沙深蓝','#163541'),sand('sand-ice','流沙浅蓝','#76b7ba'),sand('sand-wine','流沙酒红','#832330'),
  sand('sand-red','流沙大红','#b32935'),sand('sand-purple','流沙紫色','#853c94'),sand('sand-green','流沙正绿','#439558'),sand('sand-forest','流沙深绿','#176950'),sand('sand-champagne','流沙香槟金','#c5b479'),
  {id:'holo-plain',label:'素面镭射',color:'#d6d8d5',finish:'holo',roughness:.14,metalness:1,iridescence:1},
  {id:'mirror-gold',label:'亮金',color:'#dfbd45',finish:'mirror',roughness:.085,metalness:1},
  {id:'mirror-silver',label:'亮银',color:'#e3e5e3',finish:'mirror',roughness:.075,metalness:1},
  {id:'matte-gold',label:'亚金',color:'#b5a255',finish:'matte',roughness:.52,metalness:.9},
  {id:'none',label:'不包边',color:'#ffffff',finish:'none',roughness:.1,metalness:0},
  ...[{id:'gold',label:'香槟金',color:'#d1b673'},{id:'silver',label:'银色',color:'#cfd6db'},{id:'rose',label:'玫瑰金',color:'#dba794'},{id:'white',label:'奶白',color:'#f5f0e5'},{id:'black',label:'曜石黑',color:'#242529'}].map(v=>({...v,legacy:true,finish:'smooth',roughness:.26,metalness:['white','black'].includes(v.id)?.05:.85}))
];
export const baseMaterials=[
  {id:'brush-holo',label:'幻彩拉丝闪底',color:'#d8dbd4',finish:'brushed',roughness:.32,metalness:.9,grain:.22,anisotropy:.9,iridescence:1},
  {id:'brush-silver',label:'拉丝银葱',color:'#c6c9c8',finish:'brushed',roughness:.36,metalness:.92,grain:.25,anisotropy:.9},
  {id:'white-glitter',label:'白葱闪底',color:'#efeeea',finish:'glitter',roughness:.43,metalness:.38,grain:.25},
  {id:'silver-glitter',label:'银葱闪底',color:'#bfc3c7',finish:'glitter',roughness:.31,metalness:.96,grain:.58},
  {id:'violet-glitter',label:'淡紫细闪（暂定）',color:'#cbbfd3',finish:'glitter',roughness:.38,metalness:.7,grain:.38,tentative:true},
  {id:'rainbow-holo',label:'幻彩镭射（暂定）',color:'#cdd2cb',finish:'holo',roughness:.16,metalness:.98,iridescence:1,tentative:true},
  {id:'holo',label:'镭射幻彩',color:'#d4d8d5',finish:'holo',roughness:.22,metalness:.88,iridescence:1,legacy:true},
  {id:'silver',label:'细银闪',color:'#c9ced1',finish:'glitter',roughness:.34,metalness:.94,grain:.38,legacy:true},
  {id:'stars',label:'星星闪',color:'#c5d3e1',finish:'stars',roughness:.28,metalness:.84,grain:.45,iridescence:.55,legacy:true},
  {id:'pearl',label:'珠光底',color:'#f1e9df',finish:'pearl',roughness:.36,metalness:.08,iridescence:.18,legacy:true},
  {id:'clear',label:'透明底',color:'#ffffff',finish:'clear',roughness:.09,metalness:0,legacy:true}
];
export const edgeById=Object.fromEntries(edgeMaterials.map(m=>[m.id,m]));
export const baseById=Object.fromEntries(baseMaterials.map(m=>[m.id,m]));
export function foilKind(def){return def.finish==='clear'?0:def.finish==='brushed'?2:def.finish==='stars'?4:def.finish==='pearl'?5:def.iridescence>.5?3:1;}
export function foilOptics(s,def,viewX=(s.angleY||0)/30,viewY=-(s.angleX||0)/30){
  const yaw=s.lightAzimuth*Math.PI/180,elev=s.lightElevation*Math.PI/180;
  return {kind:foilKind(def),holo:def.iridescence>.5,hx:(viewX+Math.sin(yaw)*Math.cos(elev))*.5,hy:(viewY+Math.sin(elev))*.5,strength:s.glitter/100,light:.15+s.keyLight/100*.7+s.environment/100*.15};
}
const foilHash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
// Fixed surface grains with view-dependent facet highlights; no time-driven random twinkle.
export function foilResponse(o,x,y){
  const pitch=o.kind===4?2.8:.6,cx=Math.floor(x/pitch),cy=Math.floor(y/pitch),n=foilHash(cx,cy),m=foilHash(cx+53,cy+29);
  const dx=o.hx-(n-.5)*1.25,dy=o.hy-(m-.5)*1.25;
  const fx=x/pitch-cx-.5,fy=y/pitch-cy-.5;
  const shape=o.kind===4?Math.max(0,1-Math.abs(fx)*12-Math.abs(fy)*2,1-Math.abs(fy)*12-Math.abs(fx)*2):Math.max(0,1-Math.hypot(fx,fy)*1.7);
  let sparkle=Math.min(1,Math.exp(-(dx*dx+dy*dy)/.009)*shape*2.8),band=Math.pow(.5+.5*Math.cos(x*.24+o.hx*18+o.hy*4),10);
  let shade=.68+n*.1,glow=sparkle*1.8;
  if(o.kind===2){shade=.76+band*.17;glow=band*.3+sparkle*.6;}
  if(o.kind===3){shade=.8;glow=band*.15;}
  if(o.kind===5){shade=.91;glow=band*.14;}
  const hue=x*.035+y*.02+o.hx*5+o.hy*3;
  const tint=[0,2.094,4.189].map(v=>o.holo?(.5+.5*Math.cos(hue+v))*.25:0);
  return [1+(shade-1)*o.strength,...tint.map(v=>(v+glow)*o.strength*o.light)];
}
export const lightingPresets={studio:{label:'正面柔光',keyLight:75,fillLight:50,rimLight:45,environment:60,exposure:80,lightAzimuth:-18,lightElevation:22},daylight:{label:'窗边日光',keyLight:90,fillLight:22,rimLight:30,environment:55,exposure:85,lightAzimuth:-65,lightElevation:48},raking:{label:'侧光看纹理',keyLight:95,fillLight:15,rimLight:85,environment:55,exposure:90,lightAzimuth:68,lightElevation:20}};
