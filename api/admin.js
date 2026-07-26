// API back-office — sans base de données.
// Sauvegarde content.json et téléverse des photos en committant sur GitHub.
// Variables d'environnement Vercel requises :
//   ADMIN_EMAIL, ADMIN_PASSWORD, GITHUB_TOKEN (fine-grained, contents:write sur le repo), GITHUB_REPO (ex: toutifr/karinschmitt)

const GH = 'https://api.github.com';

function eq(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function gh(path, opts = {}) {
  const res = await fetch(GH + path, {
    ...opts,
    headers: {
      'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'karinschmitt-admin',
      ...(opts.headers || {})
    }
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || ('GitHub ' + res.status));
  return json;
}

async function putFile(repo, path, base64Content, message) {
  let sha;
  try {
    const cur = await gh(`/repos/${repo}/contents/${path}`);
    sha = cur.sha;
  } catch (e) { /* nouveau fichier */ }
  return gh(`/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: base64Content, sha })
  });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const { email, password, action, data, filename } = req.body || {};
  const okAuth = eq(email && email.trim().toLowerCase(), (process.env.ADMIN_EMAIL || '').toLowerCase())
              && eq(password, process.env.ADMIN_PASSWORD);
  if (!okAuth) return res.status(401).json({ error: 'Identifiants incorrects' });

  const repo = process.env.GITHUB_REPO;
  try {
    if (action === 'login') {
      return res.status(200).json({ ok: true });
    }

    if (action === 'save_content') {
      const pretty = JSON.stringify(data, null, 2);
      const b64 = Buffer.from(pretty, 'utf8').toString('base64');
      await putFile(repo, 'content.json', b64, 'Mise à jour du contenu via le back-office');
      return res.status(200).json({ ok: true });
    }

    if (action === 'upload_image') {
      // data = base64 (sans préfixe data:), filename = nom souhaité
      const safe = String(filename || 'photo.jpg').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9.-]+/g, '-').replace(/-+/g, '-');
      const path = 'images/' + Date.now() + '-' + safe;
      await putFile(repo, path, data, 'Ajout photo via le back-office : ' + safe);
      return res.status(200).json({ ok: true, src: path });
    }

    return res.status(400).json({ error: 'Action inconnue' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
