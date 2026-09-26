import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const allowed = new Set(['index.html','style.css','app.js','render.js','model.js','materials.js','decoration.js','viewer3d.bundle.js','demo.svg']);
const server = http.createServer(async (req,res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  const name = new URL(req.url,'http://localhost').pathname.slice(1) || 'index.html';
  if(name==='favicon.ico'){res.writeHead(204);res.end();return;}
  if (!allowed.has(name)) {res.writeHead(404); res.end('Not found'); return;}
  try {
    const data = await readFile(path.join(root,name));
    res.writeHead(200,{'Content-Type':types[path.extname(name)] || 'application/octet-stream','Cache-Control':'no-cache'});
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {res.writeHead(500); res.end('Unable to load asset');}
});
server.listen(Number(process.env.PORT || 4318),'127.0.0.1',()=>console.log('Acrylic Studio ready: http://127.0.0.1:4318'));
