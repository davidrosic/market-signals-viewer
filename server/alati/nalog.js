#!/usr/bin/env node
// Uprava nalozima. Pusta se NA DROPLETU, sa VLASNICKIM DSN-om:
//
//   cd /opt/aic/sajt-node/server
//   sudo -u aic env $(sudo cat /etc/aic/vlasnik.env) node alati/nalog.js dodaj ti@mejl.rs --rola admin
//
// DSN mora biti vlasnicki (rola `aic`), ne onaj iz /etc/aic/sajt.env: rola
// `sajt` NEMA INSERT nad auth.korisnik, i to je namerno -- proces okrenut
// internetu ne treba da ume da napravi sebi nalog.
//
// Lozinka se ispisuje JEDNOM i nigde se ne cuva. Ako se izgubi, radi se reset.
import crypto from 'node:crypto';
import pg from 'pg';

import { NAJKRACA_LOZINKA, ROLE, hashLozinke } from '../src/auth.js';

const UPOTREBA = `
nalog.js -- korisnici sajta

  dodaj <email> [--rola admin|gost]   napravi nalog, ispisi lozinku JEDNOM
  lista                               spisak naloga
  rola <email> <admin|gost>           promeni rolu
  ugasi <email>                       ugasi nalog i sve njegove zive sesije
  upali <email>                       ponovo upali nalog
  lozinka <email>                     nova lozinka, sesije dole
  obrisi <email>                      obrisi nalog (sesije i sacuvano kaskadno)

DSN se cita iz AIC_DSN_VLASNIK, pa iz AIC_DSN.
`;

const dsn = process.env.AIC_DSN_VLASNIK || process.env.AIC_DSN;
if (!dsn) {
  console.error('nema AIC_DSN_VLASNIK ni AIC_DSN');
  process.exit(2);
}

// 16 znakova iz 96 bita entropije.
const novaLozinka = () => crypto.randomBytes(12).toString('base64url');
const norm = (e) => String(e ?? '').trim().toLowerCase();

function ispisiLozinku(email, lozinka, rola) {
  console.log(`  napravljen ${email}${rola ? ` (${rola})` : ''}`);
  console.log(`  lozinka:   ${lozinka}`);
  console.log('  Ovo se vise nikad nece ispisati. Posalji je i zaboravi.');
}

async function nadji(k, email) {
  const { rows } = await k.query('SELECT id, email, rola, aktivan FROM auth.korisnik WHERE email = $1',
    [norm(email)]);
  if (!rows.length) {
    console.error(`nema naloga ${norm(email)}`);
    process.exit(1);
  }
  return rows[0];
}

async function main() {
  const [komanda, ...arg] = process.argv.slice(2);
  if (!komanda || komanda === '--help' || komanda === '-h') {
    console.log(UPOTREBA.trim());
    return 0;
  }
  const k = new pg.Client({ connectionString: dsn });
  await k.connect();
  try {
    if (komanda === 'dodaj') {
      const email = norm(arg[0]);
      if (!email || !email.includes('@')) throw new Error('treba mejl adresa');
      const i = arg.indexOf('--rola');
      const rola = i >= 0 ? arg[i + 1] : 'gost';
      if (!ROLE.includes(rola)) throw new Error(`rola je ${ROLE.join(' ili ')}, ne '${rola}'`);
      const lozinka = novaLozinka();
      if (lozinka.length < NAJKRACA_LOZINKA) throw new Error('generisana lozinka je prekratka');
      await k.query('INSERT INTO auth.korisnik (email, lozinka_hash, rola) VALUES ($1,$2,$3)',
        [email, await hashLozinke(lozinka), rola]);
      ispisiLozinku(email, lozinka, rola);

    } else if (komanda === 'lista') {
      const { rows } = await k.query(`
        SELECT k.email, k.rola, k.aktivan, k.poslednja_prijava,
               (SELECT count(*)::int FROM auth.sesija s
                 WHERE s.korisnik_id = k.id AND s.istice > now()) AS sesija
          FROM auth.korisnik k ORDER BY k.email`);
      if (!rows.length) return console.log('  (nema naloga)'), 0;
      for (const r of rows) {
        const kad = r.poslednja_prijava ? new Date(r.poslednja_prijava).toISOString().slice(0, 16).replace('T', ' ') : 'nikad';
        console.log(`  ${r.email.padEnd(32)} ${r.rola.padEnd(6)} ${r.aktivan ? 'upaljen ' : 'ugasen  '} sesija:${String(r.sesija).padStart(2)}  poslednja: ${kad}`);
      }

    } else if (komanda === 'rola') {
      const kor = await nadji(k, arg[0]);
      const rola = arg[1];
      if (!ROLE.includes(rola)) throw new Error(`rola je ${ROLE.join(' ili ')}, ne '${rola}'`);
      await k.query('UPDATE auth.korisnik SET rola = $1 WHERE id = $2', [rola, kor.id]);
      console.log(`  ${kor.email}: rola -> ${rola}`);

    } else if (komanda === 'ugasi' || komanda === 'upali') {
      const kor = await nadji(k, arg[0]);
      const upaljen = komanda === 'upali';
      await k.query('UPDATE auth.korisnik SET aktivan = $1 WHERE id = $2', [upaljen, kor.id]);
      // Gasenje deluje ODMAH -- zive sesije odlaze sa nalogom.
      if (!upaljen) await k.query('DELETE FROM auth.sesija WHERE korisnik_id = $1', [kor.id]);
      console.log(`  ${kor.email}: ${upaljen ? 'upaljen' : 'ugasen, sesije obrisane'}`);

    } else if (komanda === 'lozinka') {
      const kor = await nadji(k, arg[0]);
      const lozinka = novaLozinka();
      await k.query('UPDATE auth.korisnik SET lozinka_hash = $1 WHERE id = $2',
        [await hashLozinke(lozinka), kor.id]);
      await k.query('DELETE FROM auth.sesija WHERE korisnik_id = $1', [kor.id]);
      ispisiLozinku(kor.email, lozinka, null);

    } else if (komanda === 'obrisi') {
      const kor = await nadji(k, arg[0]);
      await k.query('DELETE FROM auth.korisnik WHERE id = $1', [kor.id]);
      console.log(`  ${kor.email}: obrisan (sesije i sacuvano kaskadno)`);

    } else {
      console.error(`nepoznata komanda '${komanda}'\n`);
      console.log(UPOTREBA.trim());
      return 2;
    }
  } finally {
    await k.end();
  }
  return 0;
}

main().then((k) => process.exit(k ?? 0), (e) => {
  console.error('greska:', e.message);
  process.exit(1);
});
