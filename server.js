const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || ''; // empty = no auth required (fine for trusted LAN use)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const ICONS_DIR = path.join(DATA_DIR, 'icons');
const DB_PATH = path.join(DATA_DIR, 'metadata.json');
const ALLOWED_EXT = ['png', 'svg', 'jpg', 'jpeg', 'webp', 'ico', 'gif'];

fs.mkdirSync(ICONS_DIR, { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ icons: [] }, null, 2));

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch (e) {
    return { icons: [] };
  }
}

function writeDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function slugify(name) {
  return (
    String(name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'icon'
  );
}

function randomSuffix(len = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[crypto.randomInt(0, chars.length)];
  return out;
}

function requireAuth(req, res, next) {
  if (!ADMIN_KEY) return next();
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key === ADMIN_KEY) return next();
  return res.status(401).json({ error: 'Missing or incorrect admin key' });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
}).single('file');

const app = express();
app.use(express.json());

// --- API ---

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/icons', (req, res) => {
  const db = readDB();
  const q = String(req.query.q || '').toLowerCase().trim();
  let icons = db.icons;
  if (q) {
    icons = icons.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.filename.toLowerCase().includes(q) ||
        (i.tags || []).some((t) => t.includes(q))
    );
  }
  res.json({ icons, total: icons.length, requiresKey: !!ADMIN_KEY });
});

app.post('/api/icons', requireAuth, (req, res) => {
  upload(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No file provided (field name must be "file")' });

    const ext = (path.extname(req.file.originalname).slice(1) || 'png').toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return res.status(400).json({ error: `Unsupported file type ".${ext}". Allowed: ${ALLOWED_EXT.join(', ')}` });
    }

    const rawName =
      (req.body.name && req.body.name.trim()) ||
      path.basename(req.file.originalname, path.extname(req.file.originalname));
    const slug = slugify(rawName);
    const filename = `${slug}_${randomSuffix(10)}.${ext}`;

    fs.writeFileSync(path.join(ICONS_DIR, filename), req.file.buffer);

    const tags = String(req.body.tags || '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const entry = {
      id: crypto.randomUUID(),
      name: rawName.trim() || slug,
      filename,
      tags,
      size: req.file.buffer.length,
      uploadedAt: new Date().toISOString(),
    };

    const db = readDB();
    db.icons.unshift(entry);
    writeDB(db);

    res.status(201).json(entry);
  });
});

app.patch('/api/icons/:id', requireAuth, (req, res) => {
  const db = readDB();
  const item = db.icons.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Icon not found' });

  if (typeof req.body.name === 'string' && req.body.name.trim()) item.name = req.body.name.trim();
  if (typeof req.body.tags === 'string') {
    item.tags = req.body.tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
  }

  writeDB(db);
  res.json(item);
});

app.delete('/api/icons/:id', requireAuth, (req, res) => {
  const db = readDB();
  const idx = db.icons.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Icon not found' });

  const [removed] = db.icons.splice(idx, 1);
  writeDB(db);
  fs.unlink(path.join(ICONS_DIR, removed.filename), () => {});
  res.json({ ok: true });
});

// --- Static files ---

// Direct icon links: http://<host>:<port>/icons/<filename>
app.use('/icons', express.static(ICONS_DIR, { maxAge: '365d', immutable: true }));

// Frontend UI
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Icon Store listening on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(ADMIN_KEY ? 'Admin key auth: ENABLED' : 'Admin key auth: DISABLED (open on LAN)');
});
