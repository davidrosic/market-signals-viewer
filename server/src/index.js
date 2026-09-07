// Sajt nad bazom. Node + Express; frontend je React iz web/dist.
//
//   AIC_DSN=postgresql://sajt:...@127.0.0.1:5432/aic node src/index.js
//
// --host je uvek 127.0.0.1: proces ne sme da slusa van masine ni slucajno.
// Napolje se izlazi samo kroz nginx, koji ima TLS i ogranicenje broja zahteva.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';

import { napraviBazen } from './db.js';
import { LosZahtev, napraviRute } from './rute.js';
import { zaglavlja } from './sigurnost.js';

const OVDE = path.dirname(fileURLToPath(import.meta.url));
const STATIKA = process.env.AIC_STATIKA || path.resolve(OVDE, '../../web/dist');
const PORT = Number(process.env.AIC_PORT || 8770);
const HOST = process.env.AIC_HOST || '127.0.0.1';

if (!process.env.AIC_DSN) {
  console.error('AIC_DSN nije postavljen (npr. postgresql://sajt:...@127.0.0.1:5432/aic)');
  process.exit(2);
}

const bazen = napraviBazen();
const app = express();

// Iza nginx-a; X-Forwarded-* postavlja nginx i klijentova vrednost ne prolazi.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(zaglavlja);

// Telo je ograniceno: nijedna ruta ne prima vise. Bez ovoga jedan zahtev od
// 100 MB drzi 1 GB droplet.
app.use(express.json({ limit: '16kb' }));

// Kolacici bez zavisnosti -- treba nam tacno jedan i samo za citanje; `res.cookie`
// i `res.clearCookie` su ionako u Expressu.
app.use((req, _res, next) => {
  req.cookies = Object.create(null);
  for (const deo of String(req.headers.cookie || '').split(';')) {
    const i = deo.indexOf('=');
    if (i < 1) continue;
    const ime = deo.slice(0, i).trim();
    try {
      req.cookies[ime] = decodeURIComponent(deo.slice(i + 1).trim());
    } catch {
      req.cookies[ime] = deo.slice(i + 1).trim();
    }
  }
  next();
});

app.use('/api', napraviRute(bazen));

// Statiku u produkciji sluzi nginx i ovamo ne stigne; ovo je za lokalni rad i
// za slucaj da nginx ispadne iz slike.
if (fs.existsSync(STATIKA)) {
  app.use(express.static(STATIKA, {
    index: false,
    // "no-cache" nije "no-store": pregledac cuva fajl ali svaki put pita da li
    // se promenio. Posle deploy-a nema starog bundle-a, a nema ni ponovnog
    // skidanja pri svakom kliku.
    setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
  }));
  // SPA: sve sto nije /api i nije fajl vraca ljusku.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(STATIKA, 'index.html'));
  });
} else {
  console.warn(`[sajt] nema ${STATIKA} -- pokreni "npm run build" u web/`);
}

// Telo 500-ke je uvek ista recenica; pun trag ide u dnevnik. Na javnoj masini
// tekst SQL greske u odgovoru je curenje.
app.use((e, req, res, _next) => {
  if (e instanceof LosZahtev || e?.name === 'LosKljuc')
    return res.status(400).json({ greska: e.message });
  if (e?.name === 'NemaReference') return res.status(404).json({ greska: e.message });
  if (e?.type === 'entity.too.large') return res.status(413).json({ greska: 'telo je preveliko' });
  if (e instanceof SyntaxError && 'body' in e)
    return res.status(400).json({ greska: 'telo nije ispravan JSON' });
  console.error(`[sajt] ${req.method} ${req.originalUrl}`, e);
  res.status(500).json({ greska: 'greska na serveru' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[sajt] http://${HOST}:${PORT}  (statika: ${STATIKA})`);
});

// PM2 salje SIGINT pri restartu; bez ovoga veze ostaju otvorene do isteka.
for (const s of ['SIGINT', 'SIGTERM']) {
  process.on(s, () => {
    server.close(() => bazen.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
