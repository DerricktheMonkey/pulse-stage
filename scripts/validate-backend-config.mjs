import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
const source=await readFile('public/backend-config.js','utf8'),config=runInNewContext(source+'; window.PulseBackendConfig',{window:{}},{timeout:1000});
if(!['supabase','legacy'].includes(config?.provider))throw Error('Choose a supported library provider.');
if(config.provider==='supabase'){const {publicConfig}=createRequire(import.meta.url)('../public/supabase-backend.js');publicConfig(config);console.log(config.url?'Public backend connection settings validated.':'Supabase project connection is pending; local gameplay remains available.');}
