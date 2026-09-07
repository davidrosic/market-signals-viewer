-- Korisnici i sesije sajta.
--
-- ZASTO OVO NIJE NUMERISANA MIGRACIJA, iako CLAUDE.md trazi da izmene seme idu
-- kroz `migrations/`:
--
-- `deploy/objavi.sh` osvezava podatke tako sto radi `DROP SCHEMA public CASCADE`
-- pa `pg_restore` snimka sa Maca. Time nestaje i `schema_migrations`, dakle
-- droplet posle svakog objavljivanja ima TACNO ono stanje migracija koje ima
-- Mac. Da su ove tabele nastale migracijom, na Macu bi ta migracija bila
-- zavedena kao primenjena, a na dropletu bi tabele nestale sa `public` semom --
-- i `migrate.py up` bi je preskocio jer u zapisu pise da je gotova. Tiho, i
-- tacno u trenutku kad se niko ne moze prijaviti.
--
-- Zato: zasebna sema `auth`, van dump-a (`pg_dump --schema=public`), i ovaj
-- fajl koji je idempotentan pa se sme pustiti koliko god puta.
--
--   psql "$AIC_DSN" -f deploy/auth_schema.sql

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.korisnik (
  id                bigserial PRIMARY KEY,
  email             text NOT NULL UNIQUE,
  -- scrypt$n$r$p$so_b64$hes_b64 -- parametri su U zapisu, pa se `n` moze
  -- podici kasnije a da stare lozinke i dalje rade.
  lozinka_hash      text NOT NULL,
  rola              text NOT NULL DEFAULT 'gost' CHECK (rola IN ('admin', 'gost')),
  aktivan           boolean NOT NULL DEFAULT true,
  napravljen        timestamptz NOT NULL DEFAULT now(),
  poslednja_prijava timestamptz
);

-- Cuva se SHA-256 tokena, nikad sam token. Ko procita ovu tabelu ne dobija
-- nicju sesiju -- isti razlog zbog kog se lozinka ne cuva u citljivom obliku.
CREATE TABLE IF NOT EXISTS auth.sesija (
  token_hash  text PRIMARY KEY,
  korisnik_id bigint NOT NULL REFERENCES auth.korisnik(id) ON DELETE CASCADE,
  napravljena timestamptz NOT NULL DEFAULT now(),
  istice      timestamptz NOT NULL,
  ip          inet,
  ua          text
);
CREATE INDEX IF NOT EXISTS sesija_korisnik_ix ON auth.sesija (korisnik_id);
CREATE INDEX IF NOT EXISTS sesija_istice_ix   ON auth.sesija (istice);

-- Neuspeli pokusaji: brojanje u prozoru je jedino sto zaustavlja probijanje
-- lozinke pre nego sto scrypt uopste pocne da racuna. Broji se po PARU
-- (mejl, IP) -- vidi `nalog.zakljucan` za razlog.
CREATE TABLE IF NOT EXISTS auth.pokusaj (
  id    bigserial PRIMARY KEY,
  email text,
  ip    inet,
  uspeo boolean NOT NULL,
  kad   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pokusaj_kad_ix ON auth.pokusaj (email, ip, kad DESC);

-- Rola pod kojom sajt cita bazu. Bez LOGIN-a i bez lozinke ovde: lozinku dobija
-- samo na dropletu, rucno (`ALTER ROLE sajt LOGIN PASSWORD '...'`), da nikad ne
-- udje u git.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sajt') THEN
    CREATE ROLE sajt NOLOGIN;
  END IF;
END $$;
