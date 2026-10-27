import {readFile,mkdir,writeFile,readdir,rm} from 'node:fs/promises';
const assets={};for(const name of await readdir('public')){assets['/'+name]=await readFile('public/'+name,'utf8');}
const api=(await readFile('worker/api.js','utf8')).replace('export async function api','async function api');
const engine=await readFile('public/engine.js','utf8');
const source=engine+'\nconst ASSETS='+JSON.stringify(assets)+';\n'+api+`\nexport default {async fetch(request,env,ctx){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return api(request,env,ctx);const path=url.pathname==='/'?'/index.html':url.pathname;const body=ASSETS[path];if(body===undefined)return new Response('Not found',{status:404});const type=path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8';return new Response(body,{headers:{'Content-Type':type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});}};`;
await mkdir('worker',{recursive:true});await writeFile('worker/index.js',source);
await rm('dist',{recursive:true,force:true});await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});await writeFile('dist/server/index.js',source);await writeFile('dist/.openai/hosting.json',await readFile('.openai/hosting.json'));
console.log('Built game, authenticated library API, and embedded browser assets.');
