-- Mesto za `aic` bazu u Postgres klasteru koji vec nosi drugi sajt.
-- Pusta se JEDNOM, kao administrator klastera:
--
--   sudo -u postgres psql -v loz_vlasnik="'...'" -f deploy/pg_uz_postojeci.sql
--
-- Posle ovoga administrator vise nije potreban: vracanje podataka
-- (`objavi.sh`), `auth_schema.sql`, `cuvao_schema.sql` i `grants.sql` rade
-- kao obican korisnik. Provereno: rola bez SUPERUSER/CREATEDB/CREATEROLE je
-- odradila `DROP SCHEMA public CASCADE` + `pg_restore` sa izlazom 0, uz svih
-- 53 strana kljuca i 2.326 agencija.
--
-- Nijedna ekstenzija ne treba. `migrations/001_core.sql` pravi `pg_trgm`, ali
-- ga u ovoj bazi ne koristi NISTA -- ni jedan indeks, ni jedan pogled, ni jedan
-- upit sajta -- a `pg_dump --schema=public` ekstenzije ionako ne prenosi. Zato
-- ovde nema `CREATE EXTENSION`, pa nema ni razloga da iko bude superuser.
-- (Da treba, bio bi problem: `pg_trgm` nije "trusted", pa ga obican korisnik
-- ne moze napraviti, a `objavi.sh` brise semu `public` u kojoj bi stajao.)

\set ON_ERROR_STOP on

-- Vlasnik nase baze. NOSUPERUSER i NOCREATEDB su namerni: ova rola sme sve
-- unutar baze `aic` i nista van nje. Ako nekad procuri, tudji sajt u istom
-- klasteru je i dalje van domasaja.
CREATE ROLE aic LOGIN PASSWORD :loz_vlasnik NOSUPERUSER NOCREATEDB NOCREATEROLE;

CREATE DATABASE aic OWNER aic;

-- Rola sajta se pravi ovde jer `CREATE ROLE` trazi prava koja vlasnik nema.
-- Lozinku i LOGIN dobija u koraku 4 runbook-a, kao i na zasebnom dropletu.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sajt') THEN
    CREATE ROLE sajt NOLOGIN;
  END IF;
END $$;

-- Ovo stiti NASU bazu od tudjih rola: PUBLIC podrazumevano ima CONNECT na
-- svaku bazu, pa bi bez ovoga rola tudjeg sajta mogla da udje u nasu.
REVOKE CONNECT ON DATABASE aic FROM PUBLIC;
GRANT  CONNECT ON DATABASE aic TO aic, sajt;

-- OBRNUTI SMER OVDE NE MOZE. Da `sajt` ne moze u TUDJU bazu trebalo bi
-- `REVOKE CONNECT` nad njom, a to obara tudji sajt ako se oslanja na PUBLIC.
-- Zato ta granica ide u pg_hba.conf -- vidi `deploy/pg_hba-aic.txt`, koji je
-- OBAVEZAN korak kad se klaster deli. Mereno: bez njega se rola `sajt`
-- povezala na tudju bazu i procitala joj kataloge.
