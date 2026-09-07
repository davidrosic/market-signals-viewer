-- Sacuvano: zabeleske (agencija, ponuda) i primeri (cena, tekst).
--
-- Isti razlog za postojanje van `migrations/` kao kod `deploy/auth_schema.sql`,
-- i vredi ga ponoviti jer je ovde jos ostriji: `deploy/objavi.sh` osvezava
-- podatke sa `DROP SCHEMA public CASCADE`. Sve sto korisnik napravi, a stoji u
-- `public`, nestaje pri svakom objavljivanju. Zato je i ovo u semi `auth`, koja
-- u dump nikad ne ulazi.
--
-- Fajl je idempotentan i pusta se koliko god puta:
--   psql "$AIC_DSN_VLASNIK" -f deploy/cuvao_schema.sql

CREATE SCHEMA IF NOT EXISTS auth;

-- Zajednicki spisak. Bez vlasnika: svaki prijavljen korisnik ga vidi i sme da
-- mu dodaje stavke; brise ga samo admin.
CREATE TABLE IF NOT EXISTS auth.spisak (
  id         bigserial PRIMARY KEY,
  naziv      text NOT NULL,
  napravljen timestamptz NOT NULL DEFAULT now()
);

-- Jedna sacuvana stavka. `spisak_id IS NULL` znaci privatno -- vidi je samo
-- vlasnik.
--
-- Polja od `naziv` do `method` su SNIMAK, uzet na serveru iz `public` u
-- trenutku cuvanja. Nikad iz tela zahteva: klijent salje samo `vrsta` i
-- `kljuc`, sve ostalo server procita sam. Bez toga bi prijavljen korisnik
-- mogao da upise bilo kakav "citat" sa bilo kakvim `source_url`-om, i
-- provenijencija (ogranicenje 4) bi prestala da znaci isto sto i drugde.
--
-- Snimak postoji zato sto `kljuc` sme da zastari: posle ponovne ekstrakcije
-- red u `public` ume da nestane ili da se promeni. Primer koji smo sacuvali
-- kao dokaz mora da ostane citljiv i tada -- inace bi „sacuvano" znacilo
-- „sacuvano dok se podaci ne osveze".
--
-- Namerno NEMA stranog kljuca ka `public`: te tabele umiru sa `DROP SCHEMA`,
-- pa bi FK ili srusio objavljivanje ili u tisini obrisao tudje beleske.
CREATE TABLE IF NOT EXISTS auth.stavka (
  id          bigserial PRIMARY KEY,
  korisnik_id bigint NOT NULL REFERENCES auth.korisnik(id) ON DELETE CASCADE,
  spisak_id   bigint REFERENCES auth.spisak(id) ON DELETE CASCADE,
  vrsta       text NOT NULL CHECK (vrsta IN ('agencija', 'ponuda', 'cena', 'tekst')),
  -- 'agencija:12' | 'ponuda:local seo' | 'cena:987' | 'opis:42' | 'pozicija:17'
  kljuc       text NOT NULL,
  naziv       text,
  iznos       numeric,
  iznos_do    numeric,
  jedinica    text,
  citat       text,
  label       text,
  agencija_id bigint,
  ponuda      text,
  source_url  text,
  method      text,
  sacuvana    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stavka_korisnik_ix ON auth.stavka (korisnik_id);
CREATE INDEX IF NOT EXISTS stavka_spisak_ix   ON auth.stavka (spisak_id);

-- Privatno: ista stavka kod istog korisnika samo jednom.
CREATE UNIQUE INDEX IF NOT EXISTS stavka_priv_ux
  ON auth.stavka (korisnik_id, vrsta, kljuc) WHERE spisak_id IS NULL;
-- U istom zajednickom spisku stavka stoji jednom, bez obzira ko ju je dodao.
-- Razliciti spiskovi (i privatno) smeju da drze istu stavku -- to su zasebni
-- redovi i uklanjanje sa jednog mesta ne dira ostala.
CREATE UNIQUE INDEX IF NOT EXISTS stavka_spisak_ux
  ON auth.stavka (spisak_id, vrsta, kljuc) WHERE spisak_id IS NOT NULL;
