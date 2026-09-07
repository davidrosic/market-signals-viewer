-- Prava role `sajt`. Pusta se POSLE svakog `objavi.sh`, jer
-- `DROP SCHEMA public CASCADE` odnese i tabele i prava nad njima.
--
--   psql "$AIC_DSN" -f deploy/grants.sql
--
-- Poenta nije uredniji ACL nego ovo: sajt nad skupom podataka ima SAMO SELECT.
-- Greska u SQL-u ili injekcija kroz `/api/trazi` ne moze da promeni nijedan red
-- -- jedina zastita koja radi i kad kod pogresi. Pise samo u `auth.sesija` i
-- `auth.pokusaj`, i to su jedine tabele koje se mogu izgubiti u najgorem
-- slucaju, a obe se prave same.

GRANT USAGE ON SCHEMA public TO sajt;
GRANT USAGE ON SCHEMA auth   TO sajt;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO sajt;

GRANT SELECT ON auth.korisnik TO sajt;
-- Cetiri kolone, ne cela tabela. `lozinka_hash` i `poslednja_prijava` trebaju
-- prijavi i promeni sopstvene lozinke; `rola` i `aktivan` administratorskom
-- ekranu. Namerno NEMA `INSERT` -- nalog se pravi iskljucivo sa CLI-ja, jer se
-- lozinka ispisuje jednom, i jer proces okrenut internetu ne treba da ume da
-- napravi sebi nalog.
GRANT UPDATE (lozinka_hash, poslednja_prijava, rola, aktivan)
      ON auth.korisnik TO sajt;

-- `UPDATE (istice)` je klizni rok iz `nalog.sesija`: sesija se produzava kad joj
-- ostane manje od 29 dana. Taj `UPDATE` se salje na SVAKOM zahtevu, i kad ne
-- pogodi nijedan red -- Postgres pravo proverava PRE nego sto pogleda `WHERE`.
-- Bez ovog reda prijava prodje (INSERT sme), a onda svaki sledeci zahtev vrati
-- 500 „permission denied for table sesija". Kvar se ne vidi lokalno, gde sajt
-- radi kao vlasnik `aic`; nadjen je tek kad je sajt pusten kao `sajt`.
-- Jedna kolona, ne cela tabela: `korisnik_id` i `token_hash` se ne diraju.
GRANT SELECT, INSERT, DELETE ON auth.sesija  TO sajt;
GRANT UPDATE (istice)        ON auth.sesija  TO sajt;
GRANT SELECT, INSERT         ON auth.pokusaj TO sajt;
GRANT USAGE ON SEQUENCE auth.pokusaj_id_seq  TO sajt;

-- Sacuvano (deploy/cuvao_schema.sql). Namerno BEZ `UPDATE`: sacuvana stavka se
-- ne menja, nego uklanja i sacuva ponovo. Snimak koji bi se mogao prepisati ne
-- bi vise bio snimak.
GRANT SELECT, INSERT, DELETE ON auth.stavka TO sajt;
GRANT SELECT, INSERT, DELETE ON auth.spisak TO sajt;
GRANT USAGE ON SEQUENCE auth.stavka_id_seq TO sajt;
GRANT USAGE ON SEQUENCE auth.spisak_id_seq TO sajt;
