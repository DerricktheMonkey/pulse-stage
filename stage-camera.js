(function(root){
'use strict';
const flat={x:0,y:0,z:0,scale:1};
const views=[flat,{x:7,y:-9,z:-2,scale:.86},{x:-5,y:10,z:2,scale:.86},{x:9,y:4,z:-1.5,scale:.86},{x:2,y:-11,z:2.5,scale:.86},{x:-7,y:-4,z:-2,scale:.86},{x:5,y:9,z:1,scale:.86}];
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
function pose(time,enabled=true){if(!enabled)return {...flat};const t=Math.max(0,Number(time)||0),segment=Math.floor(t/6),a=views[segment%views.length],b=views[(segment+1)%views.length],p=smooth((t%6)/2.2);return Object.fromEntries(Object.keys(flat).map(k=>[k,a[k]+(b[k]-a[k])*p]));}
function depth(w,h){return Math.max(800,Math.max(w,h)*2.4);}
function matrix(p){const a=p.x*Math.PI/180,b=p.y*Math.PI/180,c=p.z*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cc=Math.cos(c),sc=Math.sin(c);return [cc*cb,cc*sb*sa-sc*ca,cc*sb*ca+sc*sa,sc*cb,sc*sb*sa+cc*ca,sc*sb*ca-cc*sa,-sb,cb*sa,cb*ca];}
function project(x,y,w,h,p){const m=matrix(p),a=x-w/2,b=y-h/2,X=(m[0]*a+m[1]*b)*p.scale,Y=(m[3]*a+m[4]*b)*p.scale,Z=(m[6]*a+m[7]*b)*p.scale,k=depth(w,h)/(depth(w,h)-Z);return {x:w/2+X*k,y:h/2+Y*k};}
function fit(p,w,h){const view={...p};if(!w||!h)return view;for(let attempt=0;attempt<8;attempt++){let rx=0,ry=0;for(const x of [0,w])for(const y of [0,h]){const q=project(x,y,w,h,view);rx=Math.max(rx,Math.abs(q.x-w/2)/(w/2));ry=Math.max(ry,Math.abs(q.y-h/2)/(h/2));}const factor=Math.min(1,1/Math.max(rx,ry));if(factor>=.999999)break;view.scale*=factor*.99;}return view;}
function unproject(x,y,w,h,p){const m=matrix(p),X=x-w/2,Y=y-h/2,d=depth(w,h),den=m[8]*d-m[2]*X-m[5]*Y;if(Math.abs(den)<1e-8)return null;const k=m[8]*d/den,Z=d*(1-k);return {x:w/2+(m[0]*X*k+m[3]*Y*k+m[6]*Z)/p.scale,y:h/2+(m[1]*X*k+m[4]*Y*k+m[7]*Z)/p.scale};}
function css(p){return `scale3d(${p.scale},${p.scale},${p.scale}) rotateZ(${p.z}deg) rotateY(${p.y}deg) rotateX(${p.x}deg)`;}
const api={pose,fit,depth,project,unproject,css};if(typeof module!=='undefined')module.exports=api;root.StageCamera=api;
})(typeof globalThis!=='undefined'?globalThis:this);
