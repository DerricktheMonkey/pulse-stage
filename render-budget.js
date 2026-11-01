(function(root){'use strict';
function createBudget(){
 let lastTick=null,lastDraw=-Infinity,playingBefore=false,phase=0,divisor=1,estimatedDivisor=1;const intervals=[];
 function allow(now,playing,efficient=true){
  if(lastTick!==null){const dt=now-lastTick;if(dt>3&&dt<28){intervals.push(dt);if(intervals.length>24)intervals.shift();if(intervals.length===24&&!playingBefore){const ordered=intervals.slice().sort((a,b)=>a-b),hz=1000/ordered[12];estimatedDivisor=Math.max(1,Math.floor((hz+2)/60));}}}lastTick=now;
  if(playing!==playingBefore){playingBefore=playing;phase=0;divisor=estimatedDivisor;lastDraw=-Infinity;}
  if(!efficient){lastDraw=now;return true;}
  if(!playing){if(now-lastDraw<32)return false;lastDraw=now;return true;}
  const draw=phase++%divisor===0;if(draw)lastDraw=now;return draw;
 }
 function info(){return {divisor:playingBefore?divisor:estimatedDivisor};}
 return {allow,info};
}
const api={createBudget,...createBudget()};if(typeof module!=='undefined')module.exports=api;root.PulseRenderBudget=api;
})(typeof globalThis!=='undefined'?globalThis:this);
