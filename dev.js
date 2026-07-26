// Serveur de dev local : `npm run dev` → http://localhost:3000
// Sert les fichiers statiques + la fonction /api/admin, et charge .env tout seul.
// (En production, Vercel fait tout ça ; ce fichier ne sert qu'en local.)

const http = require('http');
const fs = require('fs');
const path = require('path');

// --- charge .env ---
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#')) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  });
  console.log('✓ .env chargé (' + ['ADMIN_EMAIL','ADMIN_PASSWORD','GITHUB_TOKEN','GITHUB_REPO'].filter(k => process.env[k]).join(', ') + ')');
} else {
  console.log('⚠ Pas de fichier .env à la racine — /api/admin refusera les connexions.');
}

const adminFn = require('./api/admin.js');

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // API
  if (url === '/api/admin') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { req.body = JSON.parse(body || '{}'); } catch (e) { req.body = {}; }
      // petits shims style Vercel
      res.status = c => { res.statusCode = c; return res; };
      res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
      Promise.resolve(adminFn(req, res)).catch(e => { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); });
    });
    return;
  }

  // statique (avec cleanUrls comme en prod)
  let file = url === '/' ? '/index.html' : url;
  if (!path.extname(file) && fs.existsSync(path.join(__dirname, file + '.html'))) file += '.html';
  const full = path.join(__dirname, path.normalize(file));
  if (!full.startsWith(__dirname) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.statusCode = 404; res.end('404'); return;
  }
  res.setHeader('Content-Type', MIME[path.extname(full).toLowerCase()] || 'application/octet-stream');
  fs.createReadStream(full).pipe(res);
}).listen(3000, () => console.log('▶ http://localhost:3000  (admin : http://localhost:3000/admin)'));
