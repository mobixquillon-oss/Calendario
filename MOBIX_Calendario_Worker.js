// Cloudflare Worker — MOBIX calendario
// Secrets: GITHUB_TOKEN (fine-grained, Contents read/write), ADMIN_SECRET (clave distinta de 17-24)
// Vars: ALLOWED_ORIGIN=https://mobixquillon-oss.github.io
const OWNER='mobixquillon-oss', REPO='Calendario', FILE='Calendario_MOBIX.json';
const API=`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`;
function response(body,status=200,origin=''){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, PUT, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Vary':'Origin'}})}
function toBase64(s){return btoa(Array.from(new TextEncoder().encode(s),x=>String.fromCharCode(x)).join(''))}
function fromBase64(s){return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g,'')),c=>c.charCodeAt(0)))}
export default {async fetch(request,env){
 const origin=request.headers.get('Origin')||'';
 const allowed=origin===env.ALLOWED_ORIGIN ? origin : '';
 if(request.method==='OPTIONS')return allowed?response({},204,allowed):response({error:'Origen no permitido'},403);
 if(origin && !allowed)return response({error:'Origen no permitido'},403);
 const url=new URL(request.url);
 if(url.pathname!=='/calendar')return response({error:'Ruta no encontrada'},404,allowed);
 if(!env.GITHUB_TOKEN||!env.ADMIN_SECRET||!env.ALLOWED_ORIGIN)return response({error:'Falta configurar secretos/variables del Worker'},503,allowed);
 const headers={'Accept':'application/vnd.github+json','Authorization':'Bearer '+env.GITHUB_TOKEN,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'MOBIX-Calendar'};
 const current=await fetch(API+'?t='+Date.now(),{headers,cache:'no-store'});
 if(!current.ok)return response({error:'No se pudo leer el JSON en GitHub ('+current.status+')'},502,allowed);
 const file=await current.json();
 if(request.method==='GET'){
  try{return response(JSON.parse(fromBase64(file.content)),200,allowed)}
  catch{return response({error:'JSON inválido en repositorio'},502,allowed)}
 }
 if(request.method!=='PUT')return response({error:'Método no permitido'},405,allowed);
 const supplied=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
 if(!supplied || supplied!==env.ADMIN_SECRET)return response({error:'Clave de publicación incorrecta'},401,allowed);
 let body;try{body=await request.json()}catch{return response({error:'JSON inválido'},400,allowed)}
 if(body?.app!=='MOBIX calendario'||!body.data||typeof body.data!=='object'||Array.isArray(body.data))return response({error:'Formato inválido'},400,allowed);
 const valid=/^\d{4}-\d{2}-\d{2}$/;
 if(Object.keys(body.data).length>2000 || Object.entries(body.data).some(([d,v])=>!valid.test(d)||!v||typeof v!=='object'||Object.keys(v).some(k=>!['camilaF','yarisa','camila'].includes(k))))return response({error:'Datos de turnos inválidos'},400,allowed);
 const result=await fetch(API,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({message:'Actualizar turnos MOBIX',content:toBase64(JSON.stringify(body,null,2)),sha:file.sha})});
 if(!result.ok)return response({error:'GitHub rechazó la actualización ('+result.status+'). Recarga y vuelve a intentar.'},result.status===409?409:502,allowed);
 return response({ok:true},200,allowed);
}}};
