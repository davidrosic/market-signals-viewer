// Mali skup, namerno. Testira se ono gde greska ne pravi ruzan ekran nego
// rupu: kapija nad /api/*, zastavice na kolacicu, i to da snimak dolazi iz
// baze a ne iz tela zahteva. Sve ostalo se vidi na ekranu.
//
//   npm test
import assert from 'node:assert/strict';
import test from 'node:test';

import * as auth from '../src/auth.js';
import * as cuvano from '../src/cuvano.js';
import { CSP, istoPoreklo } from '../src/sigurnost.js';

// --- lozinke ---------------------------------------------------------------
test('ista lozinka, dva heša, oba vaze (so je nasumicna)', async () => {
  const a = await auth.hashLozinke('probna-lozinka-1');
  const b = await auth.hashLozinke('probna-lozinka-1');
  assert.notEqual(a, b);
  assert.ok(await auth.proveriLozinku('probna-lozinka-1', a));
  assert.ok(await auth.proveriLozinku('probna-lozinka-1', b));
});

test('pogresna lozinka ne prolazi', async () => {
  const h = await auth.hashLozinke('tacna');
  assert.equal(await auth.proveriLozinku('netacna', h), false);
  assert.equal(await auth.proveriLozinku('', h), false);
});

test('parametri se citaju iz zapisa, pa stare lozinke rade i posle promene n', async () => {
  // Zapis napravljen slabijim parametrima mora i dalje da se proveri. Da se
  // citaju konstante iz modula, podizanje SCRYPT_N bi oborilo sve lozinke.
  const stari = 'scrypt$16384$8$1$' + Buffer.from('0123456789abcdef').toString('base64') + '$';
  const crypto = await import('node:crypto');
  const h = crypto.scryptSync('stara', Buffer.from('0123456789abcdef'), 32,
    { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  assert.ok(await auth.proveriLozinku('stara', stari + h.toString('base64')));
});

test('pokvaren zapis se odbija, ne puca', async () => {
  for (const z of ['', 'nije-zapis', 'bcrypt$1$2$3$4$5', 'scrypt$a$b$c$d$e', null, undefined]) {
    assert.equal(await auth.proveriLozinku('bilo', z), false);
  }
});

// --- kljucevi za sacuvano ---------------------------------------------------
test('kljuc mora da bude oblika prefiks:vrednost, sa prefiksom za tu vrstu', () => {
  assert.deepEqual(cuvano.razlozi('cena', 'cena:987'), ['cena', 987]);
  assert.deepEqual(cuvano.razlozi('tekst', 'opis:42'), ['opis', 42]);
  assert.deepEqual(cuvano.razlozi('ponuda', 'ponuda:local seo'), ['ponuda', 'local seo']);
  // Prefiks koji pripada drugoj vrsti se ne prima -- inace bi 'cena:1' moglo
  // da se sacuva kao agencija i snimak bi citao pogresnu tabelu.
  assert.throws(() => cuvano.razlozi('cena', 'agencija:1'), cuvano.LosKljuc);
  assert.throws(() => cuvano.razlozi('agencija', 'agencija:0'), cuvano.LosKljuc);
  assert.throws(() => cuvano.razlozi('agencija', 'agencija:abc'), cuvano.LosKljuc);
  assert.throws(() => cuvano.razlozi('agencija', 'bez-dvotacke'), cuvano.LosKljuc);
  assert.throws(() => cuvano.razlozi('izmisljena', 'agencija:1'), cuvano.LosKljuc);
  assert.throws(() => cuvano.razlozi('ponuda', 'ponuda:   '), cuvano.LosKljuc);
});

test('snimak cita bazu i ne uzima nista iz tela zahteva', async () => {
  // Lazna veza: belezi sta je pitala. Telo zahteva nosi izmisljen citat i
  // izvor -- nijedno ne sme da zavrsi u upisu.
  const pitanja = [];
  const k = {
    query: async (sql, args) => {
      pitanja.push({ sql, args });
      if (sql.includes('FROM price_point')) {
        return { rows: [{ naziv: 'SEO', citat: 'pravi citat iz baze', source_url: 'https://pravi', method: 'llm' }] };
      }
      return { rows: [{ id: 1 }] };
    },
  };
  const { red } = await cuvano.cuvaj(k, 7, 'cena', 'cena:987', null);
  assert.equal(red.id, 1);
  const upis = pitanja.find((p) => p.sql.includes('INSERT INTO auth.stavka'));
  assert.ok(upis, 'mora da postoji upis');
  assert.ok(upis.args.includes('pravi citat iz baze'));
  assert.ok(upis.args.includes('https://pravi'));
});

test('duplikat je idempotentan, ne greska', async () => {
  const k = {
    query: async (sql) => {
      if (sql.includes('INSERT INTO auth.stavka')) {
        const e = new Error('duplicate key'); e.code = '23505'; throw e;
      }
      if (sql.includes('FROM agency a')) return { rows: [{ naziv: 'X', agencija_id: 5 }] };
      return { rows: [{ id: 42 }] };
    },
  };
  const { red, novo } = await cuvano.cuvaj(k, 7, 'agencija', 'agencija:5', null);
  assert.equal(novo, false);
  assert.equal(red.id, 42);
});

test('nepostojeca referenca je 404, ne tih upis', async () => {
  const k = { query: async () => ({ rows: [] }) };
  await assert.rejects(() => cuvano.cuvaj(k, 7, 'agencija', 'agencija:999999', null),
    (e) => e instanceof cuvano.NemaReference);
});

// --- zaglavlja i poreklo ----------------------------------------------------
test('CSP nema unsafe-inline ni unsafe-eval', () => {
  assert.ok(!CSP.includes('unsafe-inline'));
  assert.ok(!CSP.includes('unsafe-eval'));
  assert.ok(CSP.includes("default-src 'self'"));
  assert.ok(CSP.includes("frame-ancestors 'none'"));
});

test('POST sa tudjim Origin-om se odbija, bez Origin-a prolazi', () => {
  const z = (origin, host) => ({ headers: { origin, host } });
  assert.equal(istoPoreklo(z('https://zlo.example', 'sajt.example')), false);
  assert.equal(istoPoreklo(z('https://sajt.example', 'sajt.example')), true);
  // Bez Origin-a je curl i alat, ne pregledac koji nekog vodi na tudju stranu.
  assert.equal(istoPoreklo(z(undefined, 'sajt.example')), true);
  assert.equal(istoPoreklo(z('nije-url', 'sajt.example')), false);
});
