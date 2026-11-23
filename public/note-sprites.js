(function(root){'use strict';
function createCache(doc,bitmapFactory=typeof root.createImageBitmap==='function'?canvas=>root.createImageBitmap(canvas):null){
 let key='',current=null,owned=[],textures=[],bitmaps=[],warmKey='',warming=null;
 function prepare(width,height,dpr,palette){
  if(!(width>0&&height>70&&dpr>0)||!palette?.length)return null;
  const signature=[width,height,dpr,...palette].join('|');if(signature===key)return current;
  for(const bitmap of bitmaps)bitmap.close?.();bitmaps=[];textures=[];warmKey='';warming=null;
  for(const canvas of owned){canvas.width=1;canvas.height=1;}owned=[];key='';current=null;
  const laneWidth=width*.91/4,laneHeight=height-70,pad=56,heads=new Map(),caps=new Map();
  function fail(){for(const canvas of owned){canvas.width=1;canvas.height=1;}owned=[];key=signature;return null;}
  function image(halfHeight,paint){
   const width=laneWidth+pad*2,height=halfHeight*2+pad*2,center=pad+halfHeight,canvas=doc.createElement('canvas');canvas.width=Math.ceil(width*dpr);canvas.height=Math.ceil(height*dpr);owned.push(canvas);
   const context=canvas.getContext('2d');if(!context)return null;context.setTransform(dpr,0,0,dpr,0,0);
   const rect=(a,b,color,inset)=>{context.fillStyle=color;context.fillRect(pad+inset,center+a*laneHeight,Math.max(0,laneWidth-inset*2),(b-a)*laneHeight);};paint(context,rect);
   const sprite={canvas,width:canvas.width/dpr,height:canvas.height/dpr,center};textures.push(sprite);return sprite;
  }
  for(const color of new Set(palette)){
   for(const chord of [false,true]){const sprite=image(.041*laneHeight,(g,rect)=>{rect(-.037,.037,'#09101de6',3);g.shadowColor=chord?'#fff2b5':color;g.shadowBlur=chord?28:12;if(chord){rect(-.041,.041,'#fff2b566',2);rect(-.034,.034,'#fff7d9',4);}rect(-.03,.03,color,5);g.shadowBlur=0;rect(-.03,-.02,'#ffffffbb',6);});if(!sprite)return fail();heads.set(color+'|'+chord,sprite);}
   const cap=image(.009*laneHeight,(g,rect)=>{g.shadowColor=color;g.shadowBlur=14;rect(-.009,.009,'#fff9df',7);g.shadowBlur=0;});if(!cap)return fail();caps.set(color,cap);
  }
  const draw=(context,sprite,x,y)=>{context.drawImage(sprite.bitmap||sprite.canvas,x-pad,y-sprite.center,sprite.width,sprite.height);};
  current={head(context,lane,x,y,chord){draw(context,heads.get(palette[lane]+'|'+!!chord),x,y);},cap(context,lane,x,y){draw(context,caps.get(palette[lane]),x,y);}};key=signature;return current;
 }
 function warm(width,height,dpr,palette){
  const prepared=prepare(width,height,dpr,palette);if(!prepared||!bitmapFactory)return Promise.resolve(prepared);
  const ticket=key;if(warmKey===ticket)return warming;warmKey=ticket;
  warming=Promise.all(textures.map(async sprite=>{try{const bitmap=await bitmapFactory(sprite.canvas);if(key===ticket){sprite.bitmap=bitmap;bitmaps.push(bitmap);}else bitmap.close?.();}catch{}})).then(()=>prepared);return warming;
 }
 return {prepare,warm};
}
// Cache the original ring and particle glow before play. Blend adjacent
// animation cells to retain smooth expansion without per-hit shadow passes.
function createEffectCache(doc,bitmapFactory=typeof root.createImageBitmap==='function'?canvas=>root.createImageBitmap(canvas):null){
 let signature='',atlases=new Map(),failed=false,warmKey='',warming=null;
 const release=asset=>{if(typeof asset.close==='function')asset.close();else{asset.width=1;asset.height=1;}};
 const frames=32,tile=192,columns=8,center=96;
 function prepare(palette){
  const next=[...new Set(palette)].join('|');if(next===signature)return !failed;
  for(const atlas of atlases.values())release(atlas);atlases=new Map();signature=next;failed=false;warmKey='';warming=null;
  try{for(const color of new Set(palette))for(const particles of [0,10]){
   const atlas=doc.createElement('canvas');atlas.width=tile*columns;atlas.height=tile*Math.ceil(frames/columns);const g=atlas.getContext('2d');if(!g)throw Error('No effect canvas');
   for(let frame=0;frame<frames;frame++){
    const p=frame/(frames-1),x=frame%columns*tile+center,y=Math.floor(frame/columns)*tile+center;
    g.strokeStyle=color;g.fillStyle=color;g.lineWidth=3*(1-p)+1;g.shadowColor=color;g.shadowBlur=15;g.beginPath();g.ellipse(x,y,12+p*48,5+p*20,0,0,Math.PI*2);g.stroke();
    for(let i=0;i<particles;i++){const angle=Math.PI*2*i/particles;g.fillRect(x+Math.cos(angle)*p*65,y+Math.sin(angle)*p*38-p*35,4*(1-p)+1,4*(1-p)+1);}
   }
   atlases.set(color+'|'+particles,atlas);
  }}catch{for(const atlas of atlases.values()){atlas.width=1;atlas.height=1;}atlases=new Map();failed=true;}
  return !failed;
 }
 function draw(g,e,p,x,y){
  const atlas=atlases.get(e.color+'|'+e.particles);if(!atlas)return false;
  const position=Math.max(0,Math.min(1,p))*(frames-1),lo=Math.floor(position),hi=Math.min(frames-1,lo+1),mix=position-lo;
  g.save();const alpha=g.globalAlpha;for(const [frame,weight] of [[lo,1-mix],[hi,mix]])if(weight>0){g.globalAlpha=alpha*(1-p)*weight;g.drawImage(atlas,frame%columns*tile,Math.floor(frame/columns)*tile,tile,tile,x-center,y-center,tile,tile);}g.restore();return true;
 }
 function warm(palette){
  if(!prepare(palette)||!bitmapFactory)return Promise.resolve();const ticket=signature;if(warmKey===ticket)return warming;warmKey=ticket;
  warming=Promise.all([...atlases].map(async([name,canvas])=>{try{const bitmap=await bitmapFactory(canvas);if(signature===ticket&&atlases.get(name)===canvas){atlases.set(name,bitmap);release(canvas);}else bitmap.close?.();}catch{}}));return warming;
 }
 return {prepare,draw,warm};
}
const api={createCache,createEffectCache};if(root.document){Object.assign(api,createCache(root.document));api.effects=createEffectCache(root.document);}if(typeof module!=='undefined')module.exports=api;root.PulseNoteSprites=api;
})(typeof globalThis!=='undefined'?globalThis:this);
