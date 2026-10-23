// 静态文件服务器（测试用）——端口 8137
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8', '.ico': 'image/x-icon'
};
const PORT = 8137;
http.createServer(function (req, res) {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  // 边界校验：只允许白名单扩展名，且 resolve 后必须仍在本项目根内
  const ext = path.extname(p).toLowerCase();
  if (!MIME[ext] || p.includes('..')) { res.writeHead(403); res.end(); return; }
  const fp = path.resolve(ROOT, '.' + path.posix.normalize('/' + p));
  if (fp !== ROOT && !fp.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(fp, function (err, data) {
    if (err) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext], 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', function () {
  console.log('serving http://127.0.0.1:' + PORT + '/');
});
