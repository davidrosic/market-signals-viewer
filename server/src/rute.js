// Rute /api/*. Kapija stoji OVDE, pre svakog upita: nema vazece sesije => 401.
//
// Kapija je nad /api/*, ne nad ljuskom. Fajlovi iz web/dist ne nose nijedan
// podatak -- svi idu kroz api() u pregledacu. Statiku na dropletu sluzi nginx i
// do Node-a ne stigne, pa bi kapija nad njom bila kapija koja se ne zakljucava.
import express from 'express';

import * as auth from './auth.js';
import * as cuvano from './cuvano.js';
import * as upiti from './upiti.js';
import { KOLACIC, istoPoreklo, obrisiKolacic, postaviKolacic } from './sigurnost.js';

// Klijent je poslao besmislicu (/api/agencija/abc). To je 400, ne 500 -- 500
// govori da je server pokvaren i tako se cita u dnevniku.
export class LosZahtev extends Error {}

function broj(v, ime) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new LosZahtev(`'${ime}' mora biti pozitivan ceo broj`);
  return n;
}

// Adresa klijenta. Iza nginx-a je to X-Forwarded-For, koji nginx postavlja sam
// (proxy_set_header), pa vrednost koju posalje klijent ne moze da prodje.
function ip(req) {
  const x = req.headers['x-forwarded-for'];
  if (x) return String(x).split(',')[0].trim();
  return req.socket?.remoteAddress ?? null;
}

const token = (req) => req.cookies?.[KOLACIC] ?? null;

export function napraviRute(bazen) {
  const r = express.Router();

  // Svaka ruta uzima vezu iz bazena i vraca je -- i kad pukne.
  const saVezom = (posao) => async (req, res, next) => {
    let k;
    try {
      k = await bazen.connect();
    } catch (e) {
      return next(e);
    }
    try {
      await posao(k, req, res);
    } catch (e) {
      next(e);
    } finally {
      k.release();
    }
  };

  // --- bez prijave ---------------------------------------------------------
  r.post('/prijava', saVezom(async (k, req, res) => {
    if (!istoPoreklo(req)) return res.status(403).json({ greska: 'lose poreklo' });
    const t = req.body ?? {};
    const ishod = await auth.prijava(k, t.email, t.lozinka, ip(req), req.headers['user-agent']);
    // Jedna poruka za nepoznat mejl, pogresnu lozinku, ugasen nalog i
    // zakljucanost. Razlika bi bila spisak postojecih mejlova.
    if (!ishod) return res.status(401).json({ greska: 'pogresan mejl ili lozinka' });
    postaviKolacic(req, res, ishod.token);
    res.json(ishod.ko);
  }));

  r.post('/odjava', saVezom(async (k, req, res) => {
    if (!istoPoreklo(req)) return res.status(403).json({ greska: 'lose poreklo' });
    await auth.odjavi(k, token(req));
    obrisiKolacic(req, res);
    res.json({ ok: true });
  }));

  // --- kapija --------------------------------------------------------------
  // Sve ispod ovoga trazi sesiju. Stoji PRE svakog upita, pa neprijavljen
  // zahtev ne dodirne nijednu tabelu sa podacima.
  r.use(async (req, res, next) => {
    if (req.method === 'POST' && !istoPoreklo(req))
      return res.status(403).json({ greska: 'lose poreklo' });
    let k;
    try {
      k = await bazen.connect();
    } catch (e) {
      return next(e);
    }
    try {
      const ko = await auth.sesija(k, token(req));
      if (!ko) return res.status(401).json({ greska: 'prijava' });
      req.ko = ko;
      next();
    } catch (e) {
      next(e);
    } finally {
      k.release();
    }
  });

  const grad = (req) => req.query.grad || null;

  // --- podaci --------------------------------------------------------------
  r.get('/ja', (req, res) => res.json(req.ko));

  r.get('/gradovi', saVezom(async (k, req, res) => res.json(await upiti.gradovi(k))));
  r.get('/pregled', saVezom(async (k, req, res) => res.json(await upiti.pregled(k, grad(req)))));
  r.get('/kategorije', saVezom(async (k, req, res) => res.json(await upiti.kategorije(k, grad(req)))));
  r.get('/gradovi-poredjenje', saVezom(async (k, req, res) => res.json(await upiti.gradoviPoredjenje(k))));
  r.get('/tehnologije', saVezom(async (k, req, res) => res.json(await upiti.tehnologije(k, grad(req)))));
  r.get('/paketi', saVezom(async (k, req, res) => res.json(await upiti.paketi(k, grad(req)))));
  r.get('/urednicke', saVezom(async (k, req, res) => res.json(await upiti.urednicke(k, grad(req)))));

  r.get('/kategorija/:ime', saVezom(async (k, req, res) => {
    const prag = req.query.prag == null ? 3 : broj(req.query.prag, 'prag');
    res.json(await upiti.kategorija(k, req.params.ime, grad(req), prag));
  }));

  r.get('/ponuda/:ime', saVezom(async (k, req, res) =>
    res.json(await upiti.ponuda(k, req.params.ime, grad(req)))));

  r.get('/agencija/:id', saVezom(async (k, req, res) => {
    const o = await upiti.agencija(k, broj(req.params.id, 'id'));
    if (!o) return res.status(404).json({ greska: 'nema te agencije' });
    res.json(o);
  }));

  r.get('/trazi', saVezom(async (k, req, res) =>
    res.json(await upiti.trazi(k, req.query.q ?? '', grad(req)))));

  // --- nalog ---------------------------------------------------------------
  r.post('/lozinka', saVezom(async (k, req, res) => {
    const t = req.body ?? {};
    const g = await auth.promeniLozinku(k, req.ko.id, t.stara, t.nova);
    res.status(g ? 400 : 200).json(g ? { greska: g } : { ok: true });
  }));

  // --- sacuvano ------------------------------------------------------------
  // Snimak NIKAD ne dolazi iz tela: prosledjuju se tacno vrsta, kljuc i
  // spisak_id, i nista vise. Vidi zaglavlje cuvano.js.
  r.get('/cuvano', saVezom(async (k, req, res) => res.json({
    stavke: await cuvano.izlistaj(k, req.ko.id),
    spiskovi: await cuvano.spiskovi(k),
  })));

  r.post('/cuvano', saVezom(async (k, req, res) => {
    const t = req.body ?? {};
    const sp = t.spisak_id == null || t.spisak_id === '' ? null : broj(t.spisak_id, 'spisak_id');
    const { red, novo } = await cuvano.cuvaj(k, req.ko.id, t.vrsta, t.kljuc, sp);
    // I spiskovi: brojac stavki na cipu bi inace ostao onakav kakav je bio pre
    // ovog upisa.
    res.json({
      stavka: red,
      novo,
      stavke: await cuvano.izlistaj(k, req.ko.id),
      spiskovi: await cuvano.spiskovi(k),
    });
  }));

  r.post('/cuvano/ukloni', saVezom(async (k, req, res) => {
    const ok = await cuvano.ukloni(k, req.ko.id, broj((req.body ?? {}).id, 'id'));
    // Ne razlikuje se "nema tog reda" od "nije tvoj": i jedno i drugo znaci da
    // ga ti ne mozes ukloniti.
    if (!ok) return res.status(403).json({ greska: 'nije tvoja stavka' });
    res.json({
      stavke: await cuvano.izlistaj(k, req.ko.id),
      spiskovi: await cuvano.spiskovi(k),
    });
  }));

  r.get('/spiskovi', saVezom(async (k, req, res) => res.json(await cuvano.spiskovi(k))));

  r.post('/spiskovi', saVezom(async (k, req, res) => {
    // Vraca se i sam red: klijent posle "novi spisak..." odmah smesta stavku u
    // njega, a za to mu treba id.
    const sp = await cuvano.napraviSpisak(k, (req.body ?? {}).naziv);
    res.json({ spisak: sp, spiskovi: await cuvano.spiskovi(k) });
  }));

  r.post('/spiskovi/ukloni', saVezom(async (k, req, res) => {
    // Brisanje spiska odnosi i tudje stavke (FK kaskada), pa je to admin posao.
    if (req.ko.rola !== 'admin') return res.status(403).json({ greska: 'nije dozvoljeno' });
    const ok = await cuvano.obrisiSpisak(k, broj((req.body ?? {}).id, 'id'));
    if (!ok) return res.status(404).json({ greska: 'nema tog spiska' });
    res.json({ spiskovi: await cuvano.spiskovi(k) });
  }));

  // --- korisnici (samo admin) ----------------------------------------------
  const samoAdmin = (req, res) => {
    if (req.ko.rola !== 'admin') {
      res.status(403).json({ greska: 'nije dozvoljeno' });
      return false;
    }
    return true;
  };

  r.get('/korisnici', saVezom(async (k, req, res) => {
    if (!samoAdmin(req, res)) return;
    const { rows } = await k.query(`
      SELECT k.id, k.email, k.rola, k.aktivan, k.napravljen, k.poslednja_prijava,
             (SELECT count(*)::int FROM auth.sesija s
               WHERE s.korisnik_id = k.id AND s.istice > now()) AS sesija
        FROM auth.korisnik k ORDER BY k.email`);
    res.json(rows);
  }));

  r.post('/korisnici', saVezom(async (k, req, res) => {
    if (!samoAdmin(req, res)) return;
    const t = req.body ?? {};
    const id = broj(t.id, 'id');
    // Nalog se ovde NE pravi -- lozinka mora nekud da se ispise, pa to radi
    // alati/nalog.js pod vlasnickom rolom. Rola 'sajt' nema INSERT nad
    // auth.korisnik, i to je namerno.
    if (t.rola !== undefined) {
      if (!auth.ROLE.includes(t.rola)) throw new LosZahtev('rola je admin ili gost');
      if (id === req.ko.id && t.rola !== 'admin')
        return res.status(400).json({ greska: 'sebi ne mozes skinuti admina' });
      await k.query('UPDATE auth.korisnik SET rola = $1 WHERE id = $2', [t.rola, id]);
    }
    if (t.aktivan !== undefined) {
      if (id === req.ko.id && !t.aktivan)
        return res.status(400).json({ greska: 'sebe ne mozes ugasiti' });
      await k.query('UPDATE auth.korisnik SET aktivan = $1 WHERE id = $2', [Boolean(t.aktivan), id]);
      // Gasenje deluje ODMAH: zive sesije odlaze sa nalogom.
      if (!t.aktivan) await k.query('DELETE FROM auth.sesija WHERE korisnik_id = $1', [id]);
    }
    const { rows } = await k.query(`
      SELECT k.id, k.email, k.rola, k.aktivan, k.napravljen, k.poslednja_prijava,
             (SELECT count(*)::int FROM auth.sesija s
               WHERE s.korisnik_id = k.id AND s.istice > now()) AS sesija
        FROM auth.korisnik k ORDER BY k.email`);
    res.json(rows);
  }));

  r.use((req, res) => res.status(404).json({ greska: `nepoznata ruta /api${req.path}` }));

  return r;
}
