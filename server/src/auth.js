// Lozinke i sesije. Isti zapis kao Python verzija (`aic/nalog.py`), pa
// POSTOJECI NALOZI RADE BEZ MIGRACIJE: `scrypt$n$r$p$so$hes`, parametri u
// samom zapisu, so po korisniku, u bazi sha256 tokena a nikad token.
//
// Nalozi se i dalje prave sa CLI-ja (`python -m aic.nalog dodaj`), jer se
// lozinka ispisuje jednom, i jer proces okrenut internetu ne treba da ume da
// napravi sebi nalog -- rola `sajt` namerno nema INSERT nad `auth.korisnik`.
import crypto from 'node:crypto';

const SCRYPT_N = 32768;      // 2^15
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const DKLEN = 32;
// Node podrazumevano dopusta 32 MB, a n=2^15 trazi 128*r*N = 32 MB plus
// rezervu -- bez ovoga scrypt puca. Ista granica kao `SCRYPT_MAXMEM` u Pythonu.
const MAXMEM = 64 * 1024 * 1024;

export const DANA_SESIJE = 30;
// Sesija se produzava kad joj ostane manje od ovoga -- da se drug ne prijavljuje
// svake nedelje, ali da napusten kolacic ipak istekne.
const PRODUZI_ISPOD_DANA = 29;
const MINUTA_PROZORA = 15;
const NAJVISE_POKUSAJA = 8;
export const NAJKRACA_LOZINKA = 12;
export const ROLE = ['admin', 'gost'];

function scrypt(lozinka, so, { N, r, p, dklen }) {
  return new Promise((ok, ne) => {
    crypto.scrypt(lozinka, so, dklen, { N, r, p, maxmem: MAXMEM },
      (g, kljuc) => (g ? ne(g) : ok(kljuc)));
  });
}

export async function hashLozinke(lozinka) {
  const so = crypto.randomBytes(16);
  const h = await scrypt(lozinka, so, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, dklen: DKLEN });
  return ['scrypt', SCRYPT_N, SCRYPT_R, SCRYPT_P,
    so.toString('base64'), h.toString('base64')].join('$');
}

export async function proveriLozinku(lozinka, zapis) {
  // Parametri se citaju IZ zapisa, ne iz konstanti gore -- inace bi podizanje
  // SCRYPT_N oborilo svaku postojecu lozinku.
  try {
    const [alg, n, r, p, soB64, hesB64] = String(zapis).split('$');
    if (alg !== 'scrypt') return false;
    const ocekivan = Buffer.from(hesB64, 'base64');
    const h = await scrypt(lozinka ?? '', Buffer.from(soB64, 'base64'),
      { N: Number(n), r: Number(r), p: Number(p), dklen: ocekivan.length });
    return h.length === ocekivan.length && crypto.timingSafeEqual(h, ocekivan);
  } catch {
    return false;
  }
}

// Hes nepostojece lozinke: racuna se da bi nepoznat mejl trajao isto koliko i
// poznat. Vrednost je nebitna, trosak je poenta.
const PRAZAN_HES = await hashLozinke(crypto.randomBytes(16).toString('base64url'));

const hashTokena = (t) => crypto.createHash('sha256').update(t).digest('hex');
const norm = (e) => String(e ?? '').trim().toLowerCase();

export async function napraviSesiju(k, korisnikId, ip, ua) {
  const token = crypto.randomBytes(32).toString('base64url');
  await k.query('DELETE FROM auth.sesija WHERE istice <= now()');
  await k.query(
    `INSERT INTO auth.sesija (token_hash, korisnik_id, istice, ip, ua)
     VALUES ($1, $2, now() + ($3 || ' days')::interval, $4, $5)`,
    [hashTokena(token), korisnikId, DANA_SESIJE, ip, String(ua ?? '').slice(0, 300)]);
  return token;
}

export async function sesija(k, token) {
  if (!token) return null;
  const th = hashTokena(token);
  const { rows } = await k.query(
    `SELECT k.id, k.email, k.rola
       FROM auth.sesija s
       JOIN auth.korisnik k ON k.id = s.korisnik_id
      WHERE s.token_hash = $1 AND s.istice > now() AND k.aktivan`, [th]);
  if (!rows.length) return null;
  // Klizni rok. Ovaj UPDATE se salje na SVAKOM zahtevu i kad ne pogodi nijedan
  // red -- Postgres pravo proverava PRE `WHERE`. Zato rola `sajt` mora da ima
  // `UPDATE (istice)` nad `auth.sesija`; bez toga prijava prodje a svaki
  // sledeci zahtev vrati 500. Vidi deploy/grants.sql.
  await k.query(
    `UPDATE auth.sesija SET istice = now() + ($1 || ' days')::interval
      WHERE token_hash = $2 AND istice < now() + ($3 || ' days')::interval`,
    [DANA_SESIJE, th, PRODUZI_ISPOD_DANA]);
  return rows[0];
}

export async function odjavi(k, token) {
  if (token) await k.query('DELETE FROM auth.sesija WHERE token_hash = $1', [hashTokena(token)]);
}

export async function zakljucan(k, email, ip) {
  // Kljuc je par (mejl, IP), ne mejl sam: sa mejlom samim svako ko zna adresu
  // tvog druga drzi ga zakljucanog zauvek, osam pogresnih lozinki na svakih
  // petnaest minuta. Sta se time gubi i zasto je u redu -- vidi `nalog.zakljucan`.
  const { rows } = await k.query(
    `SELECT count(*)::int AS n FROM auth.pokusaj
      WHERE email = $1 AND NOT uspeo
        AND kad > now() - ($2 || ' minutes')::interval
        AND ip IS NOT DISTINCT FROM $3`,
    [norm(email), MINUTA_PROZORA, ip]);
  return rows[0].n >= NAJVISE_POKUSAJA;
}

export async function prijava(k, email, lozinka, ip, ua) {
  // Razlog neuspeha se namerno ne vraca -- „nema tog mejla" i „pogresna
  // lozinka" su ista poruka napolju, inace je ovo spisak postojecih mejlova.
  const e = norm(email);
  if (await zakljucan(k, e, ip)) return null;
  const { rows } = await k.query(
    'SELECT id, email, rola, lozinka_hash, aktivan FROM auth.korisnik WHERE email = $1', [e]);
  const kor = rows[0];
  let ok = await proveriLozinku(lozinka ?? '', kor ? kor.lozinka_hash : PRAZAN_HES);
  ok = Boolean(ok && kor && kor.aktivan);
  await k.query('INSERT INTO auth.pokusaj (email, ip, uspeo) VALUES ($1,$2,$3)', [e, ip, ok]);
  if (!ok) return null;
  await k.query('UPDATE auth.korisnik SET poslednja_prijava = now() WHERE id = $1', [kor.id]);
  const token = await napraviSesiju(k, kor.id, ip, ua);
  return { token, ko: { id: kor.id, email: kor.email, rola: kor.rola } };
}

export async function promeniLozinku(k, korisnikId, stara, nova) {
  if (String(nova ?? '').length < NAJKRACA_LOZINKA)
    return `lozinka mora imati bar ${NAJKRACA_LOZINKA} znakova`;
  const { rows } = await k.query('SELECT lozinka_hash FROM auth.korisnik WHERE id = $1', [korisnikId]);
  if (!rows.length || !(await proveriLozinku(stara ?? '', rows[0].lozinka_hash)))
    return 'stara lozinka nije tacna';
  await k.query('UPDATE auth.korisnik SET lozinka_hash = $1 WHERE id = $2',
    [await hashLozinke(nova), korisnikId]);
  return null;
}
