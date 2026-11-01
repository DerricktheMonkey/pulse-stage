(function(root){'use strict';
function createCache(doc){
 let key='',current=null,owned=[];
 function prepare(width,height,dpr,palette){
  if(!(width>0&&height>70&&dpr>0)||!palette?.length)return null;
  const signature=[width,height,dpr,...palette].join('|');if(signature===key)return current;
  for(const canvas of owned){canvas.width=1;canvas.height=1;}owned=[];key='';current=null;
  const laneWidth=width*.91/4,laneHeight=height-70,heads=new Map(),caps=new Map(),bursts=new Map();
  function fail(){for(const canvas of owned){canvas.width=1;canvas.height=1;}owned=[];key=signature;return null;}
  function image(halfHeight,blur,paint){
   const pad=Math.ceil(blur*2/dpr+2),width=laneWidth+pad*2,height=halfHeight*2+pad*2,center=pad+halfHeight,canvas=doc.createElement('canvas');canvas.width=Math.ceil(width*dpr);canvas.height=Math.ceil(height*dpr);owned.push(canvas);
   const context=canvas.getContext('2d');if(!context)return null;context.setTransform(dpr,0,0,dpr,0,0);
   const rect=(a,b,color,inset)=>{context.fillStyle=color;context.fillRect(pad+inset,center+a*laneHeight,Math.max(0,laneWidth-inset*2),(b-a)*laneHeight);};paint(context,rect);
   return {canvas,width:canvas.width/dpr,height:canvas.height/dpr,center,pad};
  }
  for(const color of new Set(palette)){
   for(const chord of [false,true]){const sprite=image(.041*laneHeight,chord?28:12,(g,rect)=>{rect(-.037,.037,'#09101de6',3);g.shadowColor=chord?'#fff2b5':color;g.shadowBlur=chord?28:12;if(chord){rect(-.041,.041,'#fff2b566',2);rect(-.034,.034,'#fff7d9',4);}rect(-.03,.03,color,5);g.shadowBlur=0;rect(-.03,-.02,'#ffffffbb',6);});if(!sprite)return fail();heads.set(color+'|'+chord,sprite);}
   const cap=image(.009*laneHeight,14,(g,rect)=>{g.shadowColor=color;g.shadowBlur=14;rect(-.009,.009,'#fff9df',7);g.shadowBlur=0;});if(!cap)return fail();caps.set(color,cap);
   const glow=doc.createElement('canvas');glow.width=Math.ceil(160*dpr);glow.height=Math.ceil(100*dpr);owned.push(glow);const fx=glow.getContext('2d');if(!fx)return fail();fx.setTransform(dpr,0,0,dpr,0,0);fx.strokeStyle=color;fx.shadowColor=color;fx.shadowBlur=15;fx.lineWidth=3;fx.beginPath();fx.ellipse(80,50,60,25,0,0,Math.PI*2);fx.stroke();bursts.set(color,glow);
  }
  const draw=(context,sprite,x,y)=>{context.drawImage(sprite.canvas,x-sprite.pad,y-sprite.center,sprite.width,sprite.height);};
  current={burst(context,lane,x,y,p){const scale=.2+.8*p;context.drawImage(bursts.get(palette[lane]),x-80*scale,y-50*scale,160*scale,100*scale);},head(context,lane,x,y,chord){draw(context,heads.get(palette[lane]+'|'+!!chord),x,y);},cap(context,lane,x,y){draw(context,caps.get(palette[lane]),x,y);}};key=signature;return current;
 }
 return {prepare};
}
const api={createCache};if(root.document)Object.assign(api,createCache(root.document));if(typeof module!=='undefined')module.exports=api;root.PulseNoteSprites=api;
})(typeof globalThis!=='undefined'?globalThis:this);
