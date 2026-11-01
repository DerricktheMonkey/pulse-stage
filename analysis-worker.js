importScripts('engine.js?v=49');
onmessage=e=>{try{const {samples,rate,difficulty}=e.data;const {notes,bpm,scanVersion}=RhythmEngine.analyze(samples,rate,difficulty);postMessage({analysis:{notes,bpm,scanVersion}});}catch(error){postMessage({error:error.message});}};
