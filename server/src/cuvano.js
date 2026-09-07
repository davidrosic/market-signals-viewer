// Sacuvano: zabeleske (agencija, ponuda) i primeri (cena, tekst).
//
// Dve stvari odredjuju ceo modul:
//
// SNIMAK UZIMA SERVER, IZ BAZE. Klijent salje samo 'vrsta' i 'kljuc'; naziv,
// iznos, citat, source_url i method server procita sam. Da telo zahteva sme da
// donese citat, prijavljen korisnik bi mogao da upise bilo kakvu recenicu sa
// bilo kakvim izvorom, i provenijencija (CLAUDE.md, ogranicenje 4) bi na strani
// "Sacuvano" znacila nesto drugo nego svuda drugde.
//
// KLJUC SME DA ZASTARI, SNIMAK NE SME. Sema 'public' se pri svakom objavljivanju
// brise i vraca, pa red na koji kljuc pokazuje ume da nestane. Primer sacuvan
// kao dokaz mora da ostane citljiv i tada -- inace "sacuvano" znaci "sacuvano
// dok se podaci ne osveze". Zato snimak stoji u redu, a 'zastarelo' se racuna
// u trenutku citanja.
import { U_OPSEGU, CENA_USLOV } from './upiti.js';

export const VRSTE = ['agencija', 'ponuda', 'cena', 'tekst'];

// Koji prefiks pripada kojoj vrsti. Doslovan spisak, ne obrazac: skup je
// konacan i poznat, pa spisak gresi samo na onome sto u njemu pise.
export const PREFIKSI = {
  agencija: ['agencija'],
  ponuda: ['ponuda'],
  cena: ['cena'],
  tekst: ['opis', 'pozicija'],
};
// Prefiksi ciji je deo posle dvotacke ceo broj. 'ponuda' nije: tamo je to
// offering kljuc ('local seo', 'web design (up to 15 pages)').
const BROJCANI = new Set(['agencija', 'cena', 'opis', 'pozicija']);
const NAJDUZI_NAZIV_SPISKA = 60;

export class LosKljuc extends Error {}
export class NemaReference extends Error {}

// Definise sta kljuc JESTE, ne sta nije (ogranicenje 6.4): prefiks mora biti na
// spisku za tu vrstu, a deo posle prve dvotacke ili pozitivan ceo broj ili
// neprazan offering.
export function razlozi(vrsta, kljuc) {
  if (!VRSTE.includes(vrsta)) throw new LosKljuc(`vrsta je jedna od ${VRSTE.join(', ')}`);
  if (typeof kljuc !== 'string' || !kljuc.includes(':'))
    throw new LosKljuc("kljuc je oblika 'prefiks:vrednost'");
  const i = kljuc.indexOf(':');
  const prefiks = kljuc.slice(0, i);
  const rep = kljuc.slice(i + 1);
  if (!PREFIKSI[vrsta].includes(prefiks))
    throw new LosKljuc(`za vrstu '${vrsta}' prefiks je ${PREFIKSI[vrsta].join(' ili ')}, ne '${prefiks}'`);
  if (BROJCANI.has(prefiks)) {
    if (!/^\d+$/.test(rep) || Number(rep) <= 0)
      throw new LosKljuc(`'${prefiks}:' trazi pozitivan ceo broj`);
    return [prefiks, Number(rep)];
  }
  if (!rep.trim()) throw new LosKljuc("'ponuda:' trazi naziv ponude");
  return [prefiks, rep];
}

// Cita 'public' i vraca polja za upis. Baca NemaReference ako nema reda.
export async function snimak(k, prefiks, vrednost) {
  let sql;
  if (prefiks === 'agencija') {
    sql = `SELECT a.display_name AS naziv, a.id AS agencija_id
             FROM agency a JOIN (${U_OPSEGU}) i ON i.agency_id = a.id
            WHERE a.id = $1`;
  } else if (prefiks === 'ponuda') {
    sql = `SELECT coalesce(nz.naziv, $1) AS naziv, $1 AS ponuda
             FROM (SELECT 1) _
             LEFT JOIN v_naziv_ponude nz ON nz.offering = $1
            WHERE EXISTS (SELECT 1 FROM service s
                            JOIN (${U_OPSEGU}) i ON i.agency_id = s.agency_id
                           WHERE s.offering = $1)`;
  } else if (prefiks === 'cena') {
    sql = `SELECT coalesce(nz.naziv, p.offering) AS naziv, p.label,
                  p.amount_min AS iznos, p.amount_max AS iznos_do,
                  p.unit AS jedinica, p.raw_text AS citat,
                  p.source_url, p.method,
                  p.agency_id AS agencija_id, p.offering AS ponuda
             FROM price_point p
             JOIN (${U_OPSEGU}) i ON i.agency_id = p.agency_id
             LEFT JOIN v_naziv_ponude nz ON nz.offering = p.offering
            WHERE p.id = $1 AND ${CENA_USLOV}`;
  } else if (prefiks === 'opis') {
    sql = `SELECT s.name_raw AS naziv, s.description AS citat,
                  s.source_url, s.method,
                  s.agency_id AS agencija_id, s.offering AS ponuda
             FROM service s
             JOIN (${U_OPSEGU}) i ON i.agency_id = s.agency_id
            WHERE s.id = $1 AND s.description IS NOT NULL AND s.description <> ''`;
  } else {
    // Samo 'positioning'. 'team_size' i 'founded_year' nisu copy nego broj, a
    // primer koji cuvamo je recenica kojom agencija sebe prodaje.
    sql = `SELECT a.display_name AS naziv, t.value AS citat,
                  t.source_url, t.method, t.agency_id AS agencija_id
             FROM agency_attribute t
             JOIN (${U_OPSEGU}) i ON i.agency_id = t.agency_id
             JOIN agency a ON a.id = t.agency_id
            WHERE t.id = $1 AND t.key = 'positioning'`;
  }
  const { rows } = await k.query(sql, [vrednost]);
  if (!rows.length) throw new NemaReference(`'${prefiks}:${vrednost}' ne postoji u opsegu`);
  return rows[0];
}

const POLJA = ['naziv', 'iznos', 'iznos_do', 'jedinica', 'citat', 'label',
  'agencija_id', 'ponuda', 'source_url', 'method'];

// Vraca { red, novo }. Duplikat na istom odredistu je IDEMPOTENTAN, ne greska:
// dugme se dva puta klikne, dve kartice stoje otvorene, mreza ponovi zahtev.
// "Sacuvaj ono sto je vec sacuvano" nema smisleno neuspesan ishod. Snimak se
// pri tome NE osvezava -- snimak je iz trenutka cuvanja.
export async function cuvaj(k, korisnikId, vrsta, kljuc, spisakId) {
  const [prefiks, vrednost] = razlozi(vrsta, kljuc);
  if (spisakId != null) {
    const { rows } = await k.query('SELECT 1 FROM auth.spisak WHERE id = $1', [spisakId]);
    if (!rows.length) throw new NemaReference('nema tog spiska');
  }
  const s = await snimak(k, prefiks, vrednost);
  const kolone = POLJA.join(', ');
  const mesta = POLJA.map((_, i) => '$' + (i + 5)).join(', ');
  try {
    const { rows } = await k.query(
      `INSERT INTO auth.stavka (korisnik_id, spisak_id, vrsta, kljuc, ${kolone})
       VALUES ($1, $2, $3, $4, ${mesta}) RETURNING id`,
      [korisnikId, spisakId, vrsta, kljuc, ...POLJA.map((p) => s[p] ?? null)]);
    return { red: { id: rows[0].id }, novo: true };
  } catch (e) {
    if (e.code !== '23505') throw e; // 23505 = unique_violation
    // Ko je red upisao nije bitno kod zajednickog spiska -- stavka je tu, i to
    // je ono sto je trazeno.
    const { rows } = spisakId == null
      ? await k.query(`SELECT id FROM auth.stavka
                        WHERE spisak_id IS NULL AND korisnik_id = $1
                          AND vrsta = $2 AND kljuc = $3`, [korisnikId, vrsta, kljuc])
      : await k.query(`SELECT id FROM auth.stavka
                        WHERE spisak_id = $1 AND vrsta = $2 AND kljuc = $3`,
        [spisakId, vrsta, kljuc]);
    return { red: { id: rows[0] ? rows[0].id : null }, novo: false };
  }
}

// Koje reference jos postoje. Po jedan upit po vrsti nad celim spiskom id-jeva
// umesto jednog upita po redu -- strana sa sto stavki inace radi sto upita.
async function postojeci(k, redovi) {
  const poPrefiksu = {};
  for (const r of redovi) {
    try {
      const [p, v] = razlozi(r.vrsta, r.kljuc);
      (poPrefiksu[p] ||= []).push(v);
    } catch { /* red iz starije verzije, ostaje zastareo */ }
  }
  const upiti = {
    agencija: `SELECT a.id::text AS v FROM agency a
                 JOIN (${U_OPSEGU}) i ON i.agency_id = a.id WHERE a.id = ANY($1)`,
    cena: `SELECT p.id::text AS v FROM price_point p
             JOIN (${U_OPSEGU}) i ON i.agency_id = p.agency_id
            WHERE p.id = ANY($1) AND ${CENA_USLOV}`,
    opis: `SELECT s.id::text AS v FROM service s
             JOIN (${U_OPSEGU}) i ON i.agency_id = s.agency_id
            WHERE s.id = ANY($1) AND s.description IS NOT NULL`,
    pozicija: `SELECT t.id::text AS v FROM agency_attribute t
                 JOIN (${U_OPSEGU}) i ON i.agency_id = t.agency_id
                WHERE t.id = ANY($1) AND t.key = 'positioning'`,
    ponuda: `SELECT DISTINCT s.offering AS v FROM service s
               JOIN (${U_OPSEGU}) i ON i.agency_id = s.agency_id
              WHERE s.offering = ANY($1)`,
  };
  const ziv = new Set();
  for (const [p, vrednosti] of Object.entries(poPrefiksu)) {
    if (!upiti[p] || !vrednosti.length) continue;
    const { rows } = await k.query(upiti[p], [vrednosti]);
    for (const r of rows) ziv.add(p + ' ' + String(r.v));
  }
  return ziv;
}

// Privatne stavke ovog korisnika + sve stavke sa zajednickih spiskova. Tudja
// privatna stavka ne izlazi ni adminu -- ta granica je u samom upitu.
export async function izlistaj(k, korisnikId) {
  const { rows } = await k.query(`
    SELECT s.id, s.vrsta, s.kljuc, s.spisak_id, s.naziv,
           s.iznos::float AS iznos, s.iznos_do::float AS iznos_do,
           s.jedinica, s.citat, s.label, s.agencija_id, s.ponuda,
           s.source_url, s.method, s.sacuvana,
           s.korisnik_id = $1 AS moja,
           k.email AS ko,
           sp.naziv AS spisak_naziv,
           a.display_name AS agencija_ime, a.status AS agencija_status,
           a.merged_into_id, d.domain AS agencija_domen, a.city AS agencija_grad,
           nz.naziv AS ponuda_ime
      FROM auth.stavka s
      JOIN auth.korisnik k ON k.id = s.korisnik_id
      LEFT JOIN auth.spisak sp ON sp.id = s.spisak_id
      LEFT JOIN agency a ON a.id = s.agencija_id
      LEFT JOIN domain d ON d.agency_id = a.id AND d.is_primary
      LEFT JOIN v_naziv_ponude nz ON nz.offering = s.ponuda
     WHERE s.korisnik_id = $1 OR s.spisak_id IS NOT NULL
     ORDER BY s.sacuvana DESC, s.id DESC`, [korisnikId]);

  const ziv = await postojeci(k, rows);
  for (const r of rows) {
    try {
      const [p, v] = razlozi(r.vrsta, r.kljuc);
      r.zastarelo = !ziv.has(p + ' ' + String(v));
    } catch {
      r.zastarelo = true;
    }
    // Spojena agencija: link i dalje treba da radi, samo vodi na naslednika.
    r.cilj = (r.agencija_status === 'merged' && r.merged_into_id)
      ? r.merged_into_id : r.agencija_id;
    delete r.merged_into_id;
  }
  return rows;
}

// Brise samo vlasnik reda. Na zajednickom spisku: sta si dodao, to mozes i da
// sklonis; tudje ne. Bez toga bi jedan korisnik mogao da isprazni tudji rad.
export async function ukloni(k, korisnikId, stavkaId) {
  const r = await k.query('DELETE FROM auth.stavka WHERE id = $1 AND korisnik_id = $2',
    [stavkaId, korisnikId]);
  return r.rowCount > 0;
}

export async function spiskovi(k) {
  const { rows } = await k.query(`
    SELECT sp.id, sp.naziv, count(s.id)::int AS stavki
      FROM auth.spisak sp LEFT JOIN auth.stavka s ON s.spisak_id = sp.id
     GROUP BY sp.id, sp.naziv ORDER BY lower(sp.naziv)`);
  return rows;
}

export async function napraviSpisak(k, naziv) {
  const ime = String(naziv ?? '').split(/\s+/).filter(Boolean).join(' ')
    .slice(0, NAJDUZI_NAZIV_SPISKA);
  if (!ime) throw new LosKljuc('spisak mora imati naziv');
  const { rows } = await k.query(
    'INSERT INTO auth.spisak (naziv) VALUES ($1) RETURNING id, naziv', [ime]);
  return rows[0];
}

// Samo admin -- proveru role radi ruter. Stavke odlaze kaskadno (FK).
export async function obrisiSpisak(k, spisakId) {
  const r = await k.query('DELETE FROM auth.spisak WHERE id = $1', [spisakId]);
  return r.rowCount > 0;
}
