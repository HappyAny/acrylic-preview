import {edgeMaterials,baseMaterials,lightingPresets} from './materials.js';
import {patternNames,patternColors,filmNames} from './decoration.js';
const {label:studioLabel,...studioLighting}=lightingPresets.studio;
export const defaults = Object.freeze({width:100,height:150,thickness:3,backing:'cardboard',backingThickness:1,edge:'sand-champagne',edgeWidth:1.5,base:'brush-holo',whiteMode:'auto',maskMode:'alpha',whiteOpacity:100,inkOpacity:100,fit:'contain',scale:100,offsetX:0,offsetY:0,light:25,glitter:55,background:'warm',view:'finished',angleX:0,angleY:0,lighting:'studio',...studioLighting,explode:45,previewMode:'flat',bottomPattern:'flecks',bottomColor:'gold',bottomOpacity:65,bottomSize:12,film:'none',filmStructure:'pillars',filmPitch:16,filmDirection:0,filmPatternFinish:'laser',filmPatternCoverage:'opaque',filmMaskMode:'light',filmStrength:45,filmPattern:'none',filmColor:'silver',filmOpacity:40,filmSize:12});
export const enums = {edge:edgeMaterials.map(m=>m.id),base:baseMaterials.map(m=>m.id),whiteMode:['auto','upload','full','none'],maskMode:['alpha','light','dark'],fit:['contain','cover'],background:['warm','dark','check'],backing:['cardboard','none'],view:['finished','back','color','white','layers'],lighting:['studio','daylight','raking','custom'],previewMode:['flat','3d'],bottomPattern:Object.keys(patternNames),filmPattern:Object.keys(patternNames).filter(v=>v!=='flecks'),bottomColor:Object.keys(patternColors),filmColor:Object.keys(patternColors),filmStructure:['pillars','cross','facets','rings','omni'],filmPatternCoverage:['translucent','opaque'],filmMaskMode:['light','alpha'],filmPatternFinish:['laser','ink'],film:Object.keys(filmNames)};
export function sanitizeState(input={}) {
  const result = {...defaults};
  if(!input || typeof input!=='object')input={};
  const ranges = {width:[30,500],height:[30,500],thickness:[1,10],backingThickness:[0.3,3],edgeWidth:[0,8],whiteOpacity:[0,100],inkOpacity:[0,100],scale:[25,200],offsetX:[-50,50],offsetY:[-50,50],light:[0,100],glitter:[0,100],angleX:[-20,20],angleY:[-25,25],keyLight:[0,150],fillLight:[0,150],rimLight:[0,150],environment:[0,100],exposure:[40,160],lightAzimuth:[-180,180],lightElevation:[5,85],explode:[0,100],bottomOpacity:[0,100],bottomSize:[3,50],filmPitch:[2,40],filmDirection:[0,180],filmStrength:[0,100],filmOpacity:[0,100],filmSize:[3,50]};
  for (const [k, values] of Object.entries(enums)) if(values.includes(input[k])) result[k] = input[k];
  for (const [k,[lo,hi]] of Object.entries(ranges)) if(typeof input[k] === 'number' && Number.isFinite(input[k])) result[k] = Math.min(hi,Math.max(lo,input[k]));
  // Projects made before the cardboard option used “clear base” for no backing.
  if(input.backing==null && input.base==='clear') result.backing='none';
  if(result.base==='clear') result.base=defaults.base;
  if(input.film==='holo') result.film='gloss'; // Legacy full-film rainbow becomes clear film.
  return result;
}
export function maskCoverage(r,g,b,a,mode) {
  const alpha = a / 255;
  const luma = (2126*r + 7152*g + 722*b) / 2550000;
  return alpha * (mode === 'light' ? luma : mode === 'dark' ? 1-luma : 1);
}
// Approximate transmissive ink over white underbase. This is not an ICC print proof.
export function compositePixel(base,ink,alpha,white,inkStrength=1) {
  return base.map((v,c) => {
    const substrate = v*(1-white) + 255*white;
    return Math.round(substrate * (1-alpha*inkStrength*(1-ink[c]/255)));
  });
}
export function imageRect(iw,ih,w,h,state) {
  const ratio = (state.fit === 'cover' ? Math.max(w/iw,h/ih) : Math.min(w/iw,h/ih)) * state.scale/100;
  const rw=iw*ratio, rh=ih*ratio;
  return [(w-rw)/2+w*state.offsetX/100,(h-rh)/2+h*state.offsetY/100,rw,rh];
}
