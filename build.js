// Baut die Website aus den Vorlagen (index.html, impressum.html, datenschutz.html)
// und den Inhaltsdateien im Ordner content/. Ergebnis landet im Ordner dist/.
// Wird von Netlify bei jeder Änderung automatisch ausgeführt (siehe netlify.toml).
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const TEMPLATES = ['index.html', 'impressum.html', 'datenschutz.html'];
const COPY = ['style.css', 'danke.html', '404.html', 'kristina.jpg', 'fonts', 'images', 'admin'];

// Symbole der Leistungen (werden der Reihe nach vergeben)
const ICONS = [
  '<path d="M6 44 C 14 43, 15 35, 22 34 C 29 33, 30 25, 36 22 C 41 19, 43 13, 45 8"/><path d="M38 9 L 45.5 7 L 46 15"/><path d="M5 47 L 47 46.5" stroke="#17181A" stroke-width="1.6"/>',
  '<path d="M26 5 C 39 4.5, 47 13, 47 26 C 47.5 39, 38 47, 25.5 47 C 13 47.5, 5 38, 5.5 25 C 6 13, 14 5.5, 27 5.5" stroke="#17181A" stroke-width="1.6"/><path d="M16 26 L 23 33 L 37 18"/>',
  '<path d="M10 22 C 12 12, 22 6, 32 8 C 38 9.5, 42 13, 44 17"/><path d="M44 9 L 44.5 17.5 L 36.5 17"/><path d="M42 30 C 40 40, 30 46, 20 44 C 14 42.5, 10 39, 8 35" stroke="#17181A" stroke-width="1.8"/><path d="M8 43 L 7.5 34.5 L 15.5 35" stroke="#17181A" stroke-width="1.8"/>',
  '<path d="M26 5 C 32 8.5, 38 10, 44 10.5 C 44.5 26, 39 39, 26 47 C 13 39.5, 7.5 26.5, 8 10 C 14 9.5, 20 8, 26 5 Z" stroke="#17181A" stroke-width="1.6"/><path d="M26 17 L 26.5 29"/><path d="M26.3 35 L 26.4 36"/>',
  '<path d="M7 12 L 30 12.5" stroke="#17181A" stroke-width="1.8"/><path d="M7 25 L 40 25.5"/><path d="M7 38 L 22 38.3" stroke="#17181A" stroke-width="1.8"/><path d="M34 12.5 L 37 15.5 L 44 8"/>'
];

function readJSON(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'content', name), 'utf8'));
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function lookup(ctx, key) {
  if (key === '.') return ctx.__item !== undefined ? ctx.__item : '';
  let cur = ctx;
  for (const part of key.split('.')) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  if (cur === undefined && ctx.__parent) return lookup(ctx.__parent, key);
  return cur;
}

// Kleine Vorlagensprache: {{feld}}, {{{feld}}} (ohne Escaping), {{#liste}}…{{/liste}}
function render(tpl, ctx) {
  tpl = tpl.replace(/\{\{#([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (m, key, inner) => {
    const val = lookup(ctx, key);
    if (Array.isArray(val)) {
      return val.map((item, i) => {
        const child = (item && typeof item === 'object')
          ? Object.assign({}, item, { __parent: ctx })
          : { __item: item, __parent: ctx };
        child['@nr'] = String(i + 1).padStart(2, '0');
        child['@icon'] = ICONS[i % ICONS.length];
        return render(inner, child);
      }).join('');
    }
    return val ? render(inner, ctx) : '';
  });
  tpl = tpl.replace(/\{\{\{([\w.@]+)\}\}\}/g, (m, key) => {
    const v = lookup(ctx, key); return v == null ? '' : String(v);
  });
  tpl = tpl.replace(/\{\{([\w.@]+|\.)\}\}/g, (m, key) => esc(lookup(ctx, key)));
  return tpl;
}

function copy(src, dest) {
  if (!fs.existsSync(src)) return;
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(src)) copy(path.join(src, f), path.join(dest, f));
  } else {
    fs.copyFileSync(src, dest);
  }
}

const data = {
  start: readJSON('startseite.json'),
  leistungen: readJSON('leistungen.json'),
  arbeitsweise: readJSON('arbeitsweise.json'),
  ueber: readJSON('ueber-mich.json'),
  kontakt: readJSON('kontakt.json'),
  recht: readJSON('rechtliches.json'),
  jahr: String(new Date().getFullYear())
};
// abgeleitete Werte
data.kontakt.telefon_link = String(data.kontakt.telefon || '').replace(/[^\d+]/g, '');
data.leistungen.anzahl = (data.leistungen.leistungen || []).length;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const t of TEMPLATES) {
  const html = render(fs.readFileSync(path.join(ROOT, t), 'utf8'), data);
  const left = html.match(/\{\{[^}]*\}\}/);
  if (left) throw new Error(`Platzhalter nicht ersetzt in ${t}: ${left[0]}`);
  fs.writeFileSync(path.join(OUT, t), html);
}
for (const c of COPY) copy(path.join(ROOT, c), path.join(OUT, c));
console.log('Website gebaut:', fs.readdirSync(OUT).join(', '));
