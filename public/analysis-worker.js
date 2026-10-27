importScripts('engine.js?v=8');
onmessage=e=>{try{const {samples,rate,difficulty}=e.data;postMessage({analysis:RhythmEngine.analyze(samples,rate,difficulty)});}catch(error){postMessage({error:error.message});}};
