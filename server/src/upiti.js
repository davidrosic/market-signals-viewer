// Upiti. SQL je prenet DOSLOVNO iz `aic/sajt.py` -- menjaju se samo oznake
// parametara (`%s` -> `$1`). Komentari uz upite objasnjavaju merenja koja su
// do njih dovela i ne smeju da se izgube; ako menjas upit, prvo procitaj zasto
// je takav kakav jeste.
//
// Opseg je KALIFORNIJA. Agencija ulazi ako ima bar jednu kancelariju u CA, a
// od njenih kancelarija se prikazuju samo CA -- iste agencije imaju i NY/FL/TX
// adrese i one se ne vide nigde, ni u filterima ni u brojkama.
//
// Cene su iskljucivo SOPSTVENE (`NOT is_editorial`), u dolarima, i broje se
// jednom po agenciji i iznosu -- ista recenica na pet stranica jedne agencije
// nije pet podataka.
import { createRequire } from 'node:module';
import { parametri } from './db.js';

const require = createRequire(import.meta.url);
// Doslovan spisak, ne obrazac -- vidi alati/izvezi-nivoe.py.
const NIJE_NIVO = new Set(require('./podaci/nivoi-koji-nisu-nivoi.json'));

export const U_OPSEGU = 'SELECT agency_id FROM v_agencija_izvestaj';

export const CENA_USLOV = `
    NOT p.is_editorial
    AND coalesce(p.currency, 'USD') = 'USD'
    AND p.amount_min IS NOT NULL
    AND p.confidence >= 0.5
`;

// `%` i `_` su dzokeri u LIKE-u, a korisnik ih kuca kao slova: bez ovoga je
// upit `100%` znacio "bilo sta posle 100". `\` je izlaz i mora prvi.
function zaLike(q) {
  let c = String(q ?? '').toLowerCase();
  for (const z of ['\\', '%', '_']) c = c.split(z).join('\\' + z);
  return c;
}

// Filter po gradu, po PRISUSTVU. Prazan grad znaci cela Kalifornija.
function gradUslov(grad, alias, p) {
  if (!grad) return '';
  return ` AND EXISTS (SELECT 1 FROM agency_location gl
                        WHERE gl.agency_id = ${alias}.agency_id
                          AND gl.state = 'CA' AND lower(gl.city) = lower(${p(grad)}))`;
}

const red = (r) => r[0] ?? null;

export async function gradovi(k) {
  const { rows } = await k.query(`
    SELECT l.city AS grad, count(DISTINCT l.agency_id)::int AS agencija
      FROM agency_location l
      JOIN (${U_OPSEGU}) i ON i.agency_id = l.agency_id
     WHERE l.state = 'CA' AND l.city IS NOT NULL
     GROUP BY 1 HAVING count(DISTINCT l.agency_id) >= 2
     ORDER BY 2 DESC, 1`);
  return rows;
}

export async function pregled(k, grad) {
  const p = parametri();
  const ag = `SELECT i.agency_id FROM (${U_OPSEGU}) i WHERE true ${gradUslov(grad, 'i', p)}`;
  const n = p.args.length;
  // Isti filter se ponavlja u tri upita; svaki dobija svoju kopiju argumenata.
  const args = () => p.args.slice(0, n);

  const osnovno = await k.query(`
    WITH ag AS MATERIALIZED (${ag})
    SELECT (SELECT count(*)::int FROM ag) AS agencija,
           (SELECT count(DISTINCT p.agency_id)::int FROM price_point p
             JOIN ag ON ag.agency_id = p.agency_id
            WHERE ${CENA_USLOV}) AS sa_cenom,
           (SELECT count(DISTINCT s.offering)::int FROM service s
             JOIN ag ON ag.agency_id = s.agency_id
            WHERE s.offering IS NOT NULL) AS ponuda,
           (SELECT count(DISTINCT s.category)::int FROM service s
             JOIN ag ON ag.agency_id = s.agency_id
            WHERE s.category IS NOT NULL) AS kategorija`, args());

  const poJedinici = await k.query(`
    WITH ag AS MATERIALIZED (${ag}),
         c AS (SELECT DISTINCT p.agency_id, p.unit, p.amount_min
                 FROM price_point p JOIN ag ON ag.agency_id = p.agency_id
                WHERE ${CENA_USLOV} AND p.unit IS NOT NULL)
    SELECT unit AS jedinica, count(*)::int AS cena,
           count(DISTINCT agency_id)::int AS agencija,
           round(min(amount_min)) AS lo,
           round(percentile_disc(0.5) WITHIN GROUP (ORDER BY amount_min)) AS med,
           round(percentile_disc(0.9) WITHIN GROUP (ORDER BY amount_min)) AS p90
      FROM c GROUP BY 1 HAVING count(*) >= 3 ORDER BY 2 DESC`, args());

  // Grupisanje po (ponuda, kategorija) je delilo jednu ponudu na dva reda sa
  // dva manja broja: `design` je citao 24 umesto 60. Kategorija je ovde samo
  // natpis -- uzima se ona pod kojom ponudu vodi najvise agencija.
  const najsire = await k.query(`
    WITH ag AS MATERIALIZED (${ag}),
         sv AS (SELECT s.offering AS ponuda, s.category AS kategorija, s.agency_id
                  FROM service s JOIN ag ON ag.agency_id = s.agency_id
                 WHERE s.offering IS NOT NULL),
         p AS (SELECT ponuda, count(DISTINCT agency_id)::int AS agencija
                 FROM sv GROUP BY 1),
         kk AS (SELECT DISTINCT ON (ponuda) ponuda, kategorija FROM (
                  SELECT ponuda, kategorija, count(DISTINCT agency_id) AS n
                    FROM sv WHERE kategorija IS NOT NULL GROUP BY 1, 2) x
                 ORDER BY ponuda, n DESC, kategorija)
    SELECT p.ponuda, coalesce(nz.naziv, p.ponuda) AS naziv, kk.kategorija, p.agencija
      FROM p LEFT JOIN kk ON kk.ponuda = p.ponuda
             LEFT JOIN v_naziv_ponude nz ON nz.offering = p.ponuda
     ORDER BY p.agencija DESC, p.ponuda LIMIT 24`, args());

  return { osnovno: red(osnovno.rows), po_jedinici: poJedinici.rows, najsire: najsire.rows };
}

// Prvo se JEDNOM prebroje agencije po (kategorija, ponuda), pa se tek onda
// sabira. Prva verzija je imala korelisan podupit koji je za SVAKI red ponovo
// prolazio kroz 'service' -- upit se nije vracao ni posle minuta, a strana je
// zauvek stajala na "Loading".
export async function kategorije(k, grad) {
  const p = parametri();
  const g1 = gradUslov(grad, 's', p);
  const g2 = gradUslov(grad, 's', p);
  const { rows } = await k.query(`
    WITH i0 AS MATERIALIZED (${U_OPSEGU}),
    sv AS (SELECT s.category AS kategorija, s.offering AS ponuda, s.agency_id
             FROM service s JOIN i0 i ON i.agency_id = s.agency_id
            WHERE s.category IS NOT NULL AND s.offering IS NOT NULL ${g1}),
    -- Prag 3+ meri PONUDU, a ponuda ne pripada polici: 'web design' vodi 122
    -- ponude koje unutar te kategorije imaju dve agencije a ukupno tri i vise.
    -- Dok se brojalo unutar kategorije, polica je pisala 79 a stranica 201.
    gl AS (SELECT s.offering AS ponuda, count(DISTINCT s.agency_id) AS ag
             FROM service s JOIN i0 i ON i.agency_id = s.agency_id
            WHERE s.offering IS NOT NULL ${g2} GROUP BY 1),
    po AS (SELECT DISTINCT kategorija, ponuda FROM sv),
    ag AS (SELECT kategorija, count(DISTINCT agency_id)::int AS agencija FROM sv GROUP BY 1)
    SELECT po.kategorija, count(*)::int AS ponuda, ag.agencija,
           count(*) FILTER (WHERE gl.ag >= 3)::int AS ponuda_3plus
      FROM po JOIN ag ON ag.kategorija = po.kategorija
              JOIN gl ON gl.ponuda = po.ponuda
     GROUP BY po.kategorija, ag.agencija
     ORDER BY ag.agencija DESC`, p.args);
  return rows;
}

// Filter grada vazi i na SERVISE i na CENE. Dok nije vazio na cene, tabela je
// za Irvine pisala "1 with a price" kod ponude za koju stranica tog servisa
// kaze da cenu ne objavljuje niko -- ista cinjenica, dva broja.
//
// 'agencija' je broj RAZLICITIH agencija, ne redova: agencija koja nudi i
// "SEO" i "SEO Services" je jedna agencija.
export async function kategorija(k, ime, grad, prag) {
  const p = parametri();
  const pIme = p(ime);
  const g = gradUslov(grad, 's', p);
  const gs = gradUslov(grad, 's2', p);
  const gc = gradUslov(grad, 'pp', p);
  const { rows } = await k.query(`
    WITH i0 AS MATERIALIZED (${U_OPSEGU}),
    u_kat AS (
        SELECT DISTINCT s.offering AS ponuda
          FROM service s JOIN i0 i ON i.agency_id = s.agency_id
         WHERE s.category = ${pIme} AND s.offering IS NOT NULL ${g}),
    p AS (
        -- Broj pripada PONUDI, ne polici. Ista ponuda ume da bude svrstana
        -- razlicito kod razlicitih agencija ('digital marketing' je kod vecine
        -- 'marketing', kod nekih 'seo'), pa je brojanje unutar kategorije
        -- davalo 120 ovde i 138 na stranici tog istog servisa. Kategorija
        -- odlucuje SAMO sta ulazi u spisak.
        SELECT s2.offering AS ponuda, count(DISTINCT s2.agency_id)::int AS agencija
          FROM service s2
          JOIN i0 i2 ON i2.agency_id = s2.agency_id
          JOIN u_kat ON u_kat.ponuda = s2.offering
         WHERE true ${gs} GROUP BY 1)
    SELECT p.ponuda, coalesce(nz.naziv, p.ponuda) AS naziv, p.agencija,
           (SELECT count(DISTINCT c.agency_id)::int FROM (
                SELECT DISTINCT pp.agency_id, pp.amount_min
                  FROM price_point pp
                  JOIN i0 i2 ON i2.agency_id = pp.agency_id
                 WHERE pp.offering = p.ponuda
                   AND NOT pp.is_editorial
                   AND coalesce(pp.currency,'USD') = 'USD'
                   AND pp.amount_min IS NOT NULL
                   AND pp.confidence >= 0.5 ${gc}) c) AS sa_cenom
      FROM p LEFT JOIN v_naziv_ponude nz ON nz.offering = p.ponuda
     WHERE p.agencija >= ${p(prag)}
     ORDER BY p.agencija DESC, p.ponuda`, p.args);
  return rows;
}

// Sve o jednoj ponudi: ko je nudi, ko objavljuje cenu, i svaka cena kao
// zaseban podatak sa svojim dokazom. Cene se NE zaokruzuju u korpe ovde --
// histogram se crta u pregledacu, jer prag i sirina korpe zavise od toga sta
// se prikazuje. Server salje sirove tacke sa provenijencijom.
export async function ponuda(k, ime, grad) {
  const a = parametri();
  const agencije = await k.query(`
    SELECT DISTINCT s.agency_id AS id, s.id AS servis_id,
           d.domain, ag.display_name AS ime,
           s.name_raw AS naziv, s.description AS opis,
           s.source_url, s.method, s.category AS kategorija
      FROM service s
      JOIN (${U_OPSEGU}) i ON i.agency_id = s.agency_id
      JOIN agency ag ON ag.id = s.agency_id
      JOIN domain d ON d.agency_id = s.agency_id AND d.is_primary
     WHERE s.offering = ${a(ime)} ${gradUslov(grad, 's', a)}
     ORDER BY ag.display_name`, a.args);

  const b = parametri();
  const cene = await k.query(`
    SELECT DISTINCT ON (p.agency_id, p.amount_min, p.unit)
           p.agency_id AS id, p.id AS cena_id,
           ag.display_name AS ime, d.domain,
           p.amount_min::float AS iznos, p.amount_max::float AS iznos_do,
           p.unit AS jedinica, p.is_starting_at AS od, p.kind AS vrsta,
           p.raw_text AS citat, p.source_url, p.method, p.label
      FROM price_point p
      JOIN (${U_OPSEGU}) i ON i.agency_id = p.agency_id
      JOIN agency ag ON ag.id = p.agency_id
      JOIN domain d ON d.agency_id = p.agency_id AND d.is_primary
     WHERE p.offering = ${b(ime)} AND ${CENA_USLOV} ${gradUslov(grad, 'p', b)}
     ORDER BY p.agency_id, p.amount_min, p.unit, p.id`, b.args);

  const nz = await k.query('SELECT naziv FROM v_naziv_ponude WHERE offering = $1', [ime]);
  return {
    ponuda: ime,
    naziv: nz.rows.length ? nz.rows[0].naziv : ime,
    agencije: agencije.rows,
    cene: cene.rows,
  };
}

export async function agencija(k, aid) {
  const osn = await k.query(`
    SELECT a.id, a.display_name AS ime, a.city AS grad, a.state AS drzava,
           d.domain, cs.pages_fetched AS stranica
      FROM agency a
      JOIN (${U_OPSEGU}) i ON i.agency_id = a.id
      JOIN domain d ON d.agency_id = a.id AND d.is_primary
      LEFT JOIN crawl_state cs ON cs.domain_id = d.id
     WHERE a.id = $1`, [aid]);
  if (!osn.rows.length) return null;
  const o = { ...osn.rows[0] };

  // SAMO kalifornijske kancelarije -- vidi zaglavlje modula.
  o.kancelarije = (await k.query(`
    SELECT city AS grad, state AS drzava, is_hq AS sediste, source_url, method, citat
      FROM agency_location WHERE agency_id = $1 AND state = 'CA'
     ORDER BY is_hq DESC, city`, [aid])).rows;

  o.servisi = (await k.query(`
    SELECT id AS servis_id, name_raw AS naziv, offering AS ponuda,
           category AS kategorija, description AS opis, source_url, method
      FROM service WHERE agency_id = $1 AND offering IS NOT NULL
     ORDER BY category NULLS LAST, name_raw`, [aid])).rows;

  o.cene = (await k.query(`
    SELECT DISTINCT ON (p.amount_min, p.unit, p.label)
           p.id AS cena_id, p.label, p.offering AS ponuda,
           coalesce(nz.naziv, p.offering) AS naziv,
           p.amount_min::float AS iznos, p.amount_max::float AS iznos_do,
           p.unit AS jedinica, p.is_starting_at AS od,
           p.raw_text AS citat, p.source_url, p.method
      FROM price_point p
      LEFT JOIN v_naziv_ponude nz ON nz.offering = p.offering
     WHERE p.agency_id = $1 AND ${CENA_USLOV}
     ORDER BY p.amount_min, p.unit, p.label, p.id`, [aid])).rows;

  o.kontakti = (await k.query(`
    SELECT kind AS vrsta, value AS vrednost, source_url, method, confidence
      FROM contact WHERE agency_id = $1 ORDER BY kind, confidence DESC`, [aid])).rows;

  o.atributi = (await k.query(`
    SELECT id AS atribut_id, key AS kljuc, value AS vrednost, source_url, method
      FROM agency_attribute WHERE agency_id = $1
       AND key IN ('positioning','team_size','white_label','min_project',
                   'service_area','legal_name','founded_year')
     ORDER BY key, confidence DESC`, [aid])).rows;

  o.tehnologije = (await k.query(`
    SELECT DISTINCT t.name AS naziv, t.category AS vrsta, t.source_url
      FROM tech_signal t JOIN domain d ON d.id = t.domain_id
     WHERE d.agency_id = $1 ORDER BY t.name`, [aid])).rows;

  o.ljudi = (await k.query(`
    SELECT full_name AS ime, title AS pozicija, source_url
      FROM person WHERE agency_id = $1 ORDER BY full_name LIMIT 40`, [aid])).rows;

  return o;
}

export async function gradoviPoredjenje(k) {
  const { rows } = await k.query(`
    WITH g AS (
        SELECT l.city AS grad, l.agency_id
          FROM agency_location l
          JOIN (${U_OPSEGU}) i ON i.agency_id = l.agency_id
         WHERE l.state = 'CA' AND l.city IS NOT NULL
         GROUP BY 1, 2),
    c AS (SELECT DISTINCT g.grad, p.agency_id, p.amount_min, p.unit
            FROM price_point p JOIN g ON g.agency_id = p.agency_id
           WHERE ${CENA_USLOV})
    SELECT g.grad,
           count(DISTINCT g.agency_id)::int AS agencija,
           (SELECT count(DISTINCT c2.agency_id)::int FROM c c2
             WHERE c2.grad = g.grad) AS sa_cenom,
           (SELECT round(percentile_disc(0.5) WITHIN GROUP (ORDER BY c2.amount_min))
              FROM c c2 WHERE c2.grad = g.grad AND c2.unit = 'month') AS med_mesec,
           (SELECT round(percentile_disc(0.5) WITHIN GROUP (ORDER BY c2.amount_min))
              FROM c c2 WHERE c2.grad = g.grad AND c2.unit = 'project') AS med_projekat,
           (SELECT round(percentile_disc(0.5) WITHIN GROUP (ORDER BY c2.amount_min))
              FROM c c2 WHERE c2.grad = g.grad AND c2.unit = 'hour') AS med_sat
      FROM g GROUP BY g.grad
     HAVING count(DISTINCT g.agency_id) >= 3
     ORDER BY 2 DESC`);
  return rows;
}

export async function tehnologije(k, grad) {
  const p = parametri();
  const { rows } = await k.query(`
    SELECT t.name AS naziv, t.category AS vrsta,
           count(DISTINCT d.agency_id)::int AS agencija
      FROM tech_signal t
      JOIN domain d ON d.id = t.domain_id
      JOIN (${U_OPSEGU}) i ON i.agency_id = d.agency_id
     WHERE true ${gradUslov(grad, 'd', p)}
     GROUP BY 1, 2 HAVING count(DISTINCT d.agency_id) >= 3
     ORDER BY 3 DESC`, p.args);
  return rows;
}

// Agencije koje objavljuju NIZ cena u istoj jedinici -- to je cenovnik sa
// nivoima. Ime nivoa ('Starter', 'Growth') vazi samo kod te agencije i zato ne
// ulazi u pretragu servisa; ali obrazac pakovanja je upravo ono sto projekat
// trazi -- kako prodaju, ne samo sta.
export async function paketi(k, grad) {
  const p = parametri();
  const { rows } = await k.query(`
    WITH ag AS MATERIALIZED (SELECT i.agency_id FROM (${U_OPSEGU}) i
                              WHERE true ${gradUslov(grad, 'i', p)}),
    c AS (
        -- GROUP BY po istim kolonama po kojima je stajao DISTINCT daje ISTE
        -- redove, uz min(p.id) kao reprezentativni red grupe. Determinizam je
        -- uslov: dugme "sacuvaj" salje taj id, pa on ne sme da se menja izmedju
        -- dva zahteva.
        SELECT p.agency_id, p.unit, p.amount_min::float AS iznos,
               coalesce(p.label, p.offering) AS nivo, p.raw_text AS citat,
               p.source_url, min(p.id) AS cena_id
          FROM price_point p
          JOIN ag ON ag.agency_id = p.agency_id
         WHERE ${CENA_USLOV} AND p.unit IS NOT NULL
           AND coalesce(p.label, p.offering) IS NOT NULL
         GROUP BY 1, 2, 3, 4, 5, 6)
    SELECT c.agency_id AS id, a.display_name AS ime, d.domain, c.unit AS jedinica,
           count(*)::int AS nivoa, min(c.iznos) AS lo, max(c.iznos) AS hi,
           json_agg(json_build_object('nivo', c.nivo, 'iznos', c.iznos,
                                      'citat', c.citat, 'source_url', c.source_url,
                                      'cena_id', c.cena_id)
                    ORDER BY c.iznos, c.cena_id) AS nivoi
      FROM c
      JOIN agency a ON a.id = c.agency_id
      JOIN domain d ON d.agency_id = c.agency_id AND d.is_primary
     GROUP BY 1, 2, 3, c.unit
    HAVING count(*) BETWEEN 2 AND 12
     ORDER BY count(*) DESC, max(c.iznos) DESC LIMIT 260`, p.args);

  // Nivo cije je ime samo rec za IZNOS nije nivo cenovnika nego stavka iz
  // kontakt forme -- 'Budget Range' cetiri puta nije lestvica. Spisak dolazi iz
  // alati/izvezi-nivoe.py; sud donosi Python (ponuda.je_samo_iznos), ovde stoji
  // samo rezultat, pa nema logike koja moze da se raziđe.
  const cist = [];
  for (const r of rows) {
    const nivoi = (r.nivoi || []).filter(
      (n) => !NIJE_NIVO.has(String(n.nivo ?? '').trim().toLowerCase()));
    // Imena moraju i da se razlikuju: 'Price, Price, Price' je jedan natpis
    // ponovljen, ne tri nivoa.
    const razlicitih = new Set(nivoi.map((n) => String(n.nivo ?? '').trim().toLowerCase()));
    if (razlicitih.size < 2) continue;
    cist.push({
      ...r,
      nivoi,
      nivoa: nivoi.length,
      lo: Math.min(...nivoi.map((n) => n.iznos)),
      hi: Math.max(...nivoi.map((n) => n.iznos)),
    });
  }
  cist.sort((a, b) => b.nivoa - a.nivoa || b.hi - a.hi);
  return cist.slice(0, 120);
}

// Trzisni proseci i tudje cene iz njihovih blogova. NIKAD se ne mesaju sa
// sopstvenim cenama -- to je bio najbrojniji kvar projekta. Ovde stoje zato sto
// pokazuju KAKO agencija govori o novcu.
//
// Pogled se pridruzuje SPOLJA, nad vec odsecenih 400 redova: kad je stajao
// unutra, planer ga je racunao pre LIMIT-a i strana je sa 2,0s otisla na 2,6s.
// Spisak agencija mora da bude MATERIALIZED -- bez toga PostgreSQL racuna
// v_agencija_izvestaj iznova za svaki red, i strana za Irvine je stajala 2,36s
// dok je ista strana bez grada trajala 0,33s. Sa materijalizacijom 0,05s.
export async function urednicke(k, grad) {
  const p = parametri();
  const { rows } = await k.query(`
    WITH ag AS MATERIALIZED (SELECT i.agency_id FROM (${U_OPSEGU}) i
                              WHERE true ${gradUslov(grad, 'i', p)}),
    x AS MATERIALIZED (
        SELECT DISTINCT ON (p.agency_id, p.amount_min, p.raw_text)
               p.agency_id AS id, a.display_name AS ime, d.domain,
               p.amount_min::float AS iznos, p.amount_max::float AS iznos_do,
               p.unit AS jedinica, p.raw_text AS citat, p.source_url,
               p.offering AS ponuda
          FROM price_point p
          JOIN ag ON ag.agency_id = p.agency_id
          JOIN agency a ON a.id = p.agency_id
          JOIN domain d ON d.agency_id = p.agency_id AND d.is_primary
         WHERE p.is_editorial AND p.amount_min IS NOT NULL
           AND coalesce(p.currency,'USD') = 'USD'
         ORDER BY p.agency_id, p.amount_min, p.raw_text LIMIT 400)
    SELECT x.*, coalesce(nz.naziv, x.ponuda) AS naziv
      FROM x LEFT JOIN v_naziv_ponude nz ON nz.offering = x.ponuda
     ORDER BY x.id, x.iznos`, p.args);
  return rows;
}

export async function trazi(k, q, grad) {
  const uz = '%' + zaLike(q) + '%';

  const a = parametri();
  // Kao i na naslovnoj: broj pripada ponudi, kategorija je natpis.
  const ponude = await k.query(`
    WITH sv AS (
        SELECT s.offering AS ponuda, s.category AS kategorija, s.agency_id
          FROM service s
          JOIN (${U_OPSEGU}) i ON i.agency_id = s.agency_id
         WHERE s.offering IS NOT NULL
           AND s.offering LIKE ${a(uz)} ESCAPE '\\' ${gradUslov(grad, 's', a)}),
    p AS (SELECT ponuda, count(DISTINCT agency_id)::int AS agencija FROM sv GROUP BY 1),
    kk AS (SELECT DISTINCT ON (ponuda) ponuda, kategorija FROM (
             SELECT ponuda, kategorija, count(DISTINCT agency_id) AS n
               FROM sv WHERE kategorija IS NOT NULL GROUP BY 1, 2) x
            ORDER BY ponuda, n DESC, kategorija)
    SELECT p.ponuda, coalesce(nz.naziv, p.ponuda) AS naziv, kk.kategorija, p.agencija
      FROM p LEFT JOIN kk ON kk.ponuda = p.ponuda
             LEFT JOIN v_naziv_ponude nz ON nz.offering = p.ponuda
     ORDER BY p.agencija DESC, p.ponuda LIMIT 30`, a.args);

  // Izbor grada nije vazio ovde: pretraga je i za Irvine vracala agencije iz
  // cele Kalifornije, dok je spisak ponuda iznad nje bio filtriran. Tabela
  // 'agency' nema kolonu agency_id nego id, pa gradUslov ovde ne moze kakav jeste.
  const b = parametri();
  const uz1 = b(uz);
  const uz2 = b(uz);
  const gag = grad
    ? ` AND EXISTS (SELECT 1 FROM agency_location gl
                     WHERE gl.agency_id = a.id AND gl.state = 'CA'
                       AND lower(gl.city) = lower(${b(grad)}))`
    : '';
  const agencije = await k.query(`
    SELECT a.id, a.display_name AS ime, d.domain, a.city AS grad
      FROM agency a
      JOIN (${U_OPSEGU}) i ON i.agency_id = a.id
      JOIN domain d ON d.agency_id = a.id AND d.is_primary
     WHERE (lower(a.display_name) LIKE ${uz1} ESCAPE '\\'
            OR d.domain LIKE ${uz2} ESCAPE '\\') ${gag}
     ORDER BY a.display_name LIMIT 20`, b.args);

  return { ponude: ponude.rows, agencije: agencije.rows };
}
