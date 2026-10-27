(function(root){
const defaults=['#8affdc','#f98cc9','#8affdc','#f98cc9'];
function hsl(r,g,b){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));h=(max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4)*60;}return [h,s,l];}
function hex(h,s,l){const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};return '#'+f(0)+f(8)+f(4);}
function fromPixels(pixels){
 const bins=new Map();let count=0;
 for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]<128)continue;const r=pixels[i],g=pixels[i+1],b=pixels[i+2],[h,s,l]=hsl(r,g,b);if(l<.035||l>.97)continue;count++;const key=[r>>5,g>>5,b>>5].join(',');let bin=bins.get(key);if(!bin){bin={r:0,g:0,b:0,n:0,weight:0};bins.set(key,bin);}bin.r+=r;bin.g+=g;bin.b+=b;bin.n++;bin.weight+=.2+s*1.5+Math.min(l,1-l);}
 if(!count){return ['#d4dce5','#b8c2ce','#edf1f5','#a0afbf'];}
 const ranked=[...bins.values()].sort((a,b)=>b.weight-a.weight).map(c=>hsl(c.r/c.n,c.g/c.n,c.b/c.n));const picked=[];
 for(const c of ranked){if(picked.every(p=>Math.min(Math.abs(c[0]-p[0]),360-Math.abs(c[0]-p[0]))>28||Math.abs(c[1]-p[1])>.4)){picked.push(c);if(picked.length===4)break;}}
 const dominant=picked[0]||ranked[0];while(picked.length<4){const i=picked.length;picked.push([(dominant[0]+[0,8,-8,15][i]+360)%360,dominant[1]*[1,.8,1,.65][i],dominant[2]]);}
 // Retain sampled hues, with enough luminance to read over a darkened stage.
 return picked.map(([h,s],i)=>hex(h,Math.min(.95,s),[.72,.81,.65,.87][i]));
}
const api={defaults,fromPixels};if(typeof module!=='undefined')module.exports=api;root.StagePalette=api;
})(typeof window!=='undefined'?window:globalThis);
