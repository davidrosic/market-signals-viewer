# sajt-node

Sajt nad bazom agencija: **Node 20 + Express** (backend) i **React + Vite**
(frontend). Ovo je JEDINI repozitorijum koji ide na droplet.

Pipeline (crawl, ekstrakcija, llama.cpp) je u drugom repozitorijumu, Python je
i ostaje kod kuce. Ovaj sajt je samo **citac**: rola `sajt` nad semom `public`
ima samo `SELECT`.

```
sajt-node/
  server/           Express; dve zavisnosti (express, pg)
    src/            index.js, rute.js, upiti.js, auth.js, cuvano.js, db.js, sigurnost.js
    alati/nalog.js  pravljenje i uprava nalozima
    test/           deset testova, 0,5 s
  web/              React + Vite
    src/prikazi/    jedanaest prikaza
    dist/           IZGRADJENO, i ide u git (vidi "Zasto dist ide u git")
  baza/             sema, role i prava -- pusta se NA DROPLETU
  nginx-aic.conf    server blok
  pokreni.sh        omotac za PM2: cita /etc/aic/sajt.env, spusta prava
  ecosystem.config.cjs
  rezerva.sh        dnevna kopija seme `auth`
```

---

## Baza: sta ide odakle

Ovo su **dve odvojene stvari** i mesaju se lako:

| | gde stoji | kako stize na droplet |
|---|---|---|
| **sema** (tabele, role, prava) | `baza/*.sql`, u ovom repou | `git pull` pa `psql -f` |
| **podaci** (569 agencija, 413 MB) | nigde u gitu | `deploy/objavi.sh` sa Maca, preko ssh |

Podaci **nikad** ne ulaze u git. Dump je 59 MB u `-Fc` obliku i ide direktno sa
Maca na droplet; vracanje traje oko 7 sekundi. Skripta je `deploy/objavi.sh` u
pipeline repou i pusta se **na Macu**, ne ovde.

Sema `auth` (korisnici, sesije, sacuvano) je **van dump-a** (`pg_dump
--schema=public`), pa je osvezavanje podataka ne moze obrisati. To je jedini
nenadoknadiv podatak na dropletu -- otud `rezerva.sh`.

---

## Postavljanje na droplet

Droplet vec nosi Postgres 17 sa drugim sajtom, pa se koristi POSTOJECI klaster;
nas dobija svoju bazu i svoje role. Detalji i zamke su u `deploy/uz-drugi-sajt.md`
(pipeline repo).

### 1. Kod

Prvo korisnik pod kojim ce servis raditi. Sistemski nalog bez prijave -- sluzi
samo da proces okrenut internetu ne bude root:

```bash
sudo adduser --system --group --no-create-home --shell /usr/sbin/nologin aic
```

Bez ovog koraka svaki kasniji `chown root:aic` puca sa
`chown: invalid group: 'root:aic'`.

```bash
sudo mkdir -p /opt/aic-sajt /var/log/aic
git clone <url-ovog-repoa> /opt/aic-sajt
sudo chown -R root:aic /opt/aic-sajt && sudo chmod -R a+rX /opt/aic-sajt
cd /opt/aic-sajt/server && npm ci --omit=dev
```

`a+rX` treba nginx-u: on radi kao `www-data` i cita `web/dist`.

`npm ci` samo u `server/`. `web/` se NE gradi ovde -- `dist/` vec stoji u repou.

### 2. Baza i role   ← jednom, kao administrator klastera

**`-hex`, ne `-base64`.** `openssl rand -base64` daje `+`, `/` i `=`, a `/` u
lozinci obara DSN: `postgresql://aic:x5KU.../J9L@127.0.0.1:5432/aic` se raspada
na tom `/`, pa libpq procita `x5KU...` kao PORT i javi
`invalid integer value ... for connection option "port"`. Provereno: `/` obara,
`+` prolazi, hex prolazi. 24 bajta u hex-u je 48 znakova i 192 bita -- vise nego
dovoljno.

```bash
LOZ_VLASNIK=$(openssl rand -hex 24) && echo "VLASNIK: $LOZ_VLASNIK"
sudo -u postgres psql -v loz_vlasnik="'$LOZ_VLASNIK'" -f /opt/aic-sajt/baza/pg_uz_postojeci.sql
LOZ_SAJT=$(openssl rand -hex 24) && echo "SAJT: $LOZ_SAJT"
sudo -u postgres psql -c "ALTER ROLE sajt LOGIN PASSWORD '$LOZ_SAJT'"
```

### 3. Granica prema tudjoj bazi   ← obavezno

```bash
sudo sh -c 'cat /opt/aic-sajt/baza/pg_hba-aic.txt \
    /etc/postgresql/17/main/pg_hba.conf > /tmp/hba && \
    cp /tmp/hba /etc/postgresql/17/main/pg_hba.conf'
sudo systemctl reload postgresql
```

Bez ovoga se rola `sajt` -- ona kojom se povezuje proces okrenut internetu --
povezuje i na bazu drugog sajta. Izmereno, nije teorija. Objasnjenje je u samom
`baza/pg_hba-aic.txt`.

### 4. Lozinke u fajlove

```bash
sudo mkdir -p /etc/aic && sudo chmod 750 /etc/aic
echo "AIC_DSN_VLASNIK=postgresql://aic:$LOZ_VLASNIK@127.0.0.1:5432/aic" \
  | sudo tee /etc/aic/vlasnik.env >/dev/null
echo "AIC_RESTART='sudo -n pm2 restart aic-sajt'" | sudo tee -a /etc/aic/vlasnik.env >/dev/null
sudo chmod 640 /etc/aic/vlasnik.env && sudo chown root:aic /etc/aic/vlasnik.env

echo "AIC_DSN=postgresql://sajt:$LOZ_SAJT@127.0.0.1:5432/aic" \
  | sudo tee /etc/aic/sajt.env >/dev/null
sudo chmod 640 /etc/aic/sajt.env && sudo chown root:aic /etc/aic/sajt.env
```

`AIC_RESTART` cita `objavi.sh` -- bez njega bi pokusao `systemctl`, a ovde je PM2.

Proveri odmah, pre seme -- inace se kvar u DSN-u vidi tek tri koraka kasnije:

```bash
set -a; . /etc/aic/vlasnik.env; set +a
psql "$AIC_DSN_VLASNIK" -c 'SELECT current_user, current_database()'
```

### 5. Sema

```bash
set -a; . /etc/aic/vlasnik.env; set +a
psql "$AIC_DSN_VLASNIK" -f /opt/aic-sajt/baza/auth_schema.sql
psql "$AIC_DSN_VLASNIK" -f /opt/aic-sajt/baza/cuvao_schema.sql
psql "$AIC_DSN_VLASNIK" -f /opt/aic-sajt/baza/grants.sql
```

### 6. Servis

```bash
sudo pm2 start /opt/aic-sajt/ecosystem.config.cjs
sudo pm2 save
sudo pm2 install pm2-logrotate
echo "$USER ALL=(root) NOPASSWD: /usr/bin/pm2 restart aic-sajt" \
  | sudo tee /etc/sudoers.d/aic-sajt >/dev/null
sudo chmod 440 /etc/sudoers.d/aic-sajt && sudo visudo -c
```

### 7. Podaci   ← sa MACA, iz pipeline repoa

```bash
AIC_DROPLET=<ti>@<ip> deploy/objavi.sh
```

### 8. Prvi nalog

```bash
cd /opt/aic-sajt/server
sudo -u aic env $(sudo cat /etc/aic/vlasnik.env | grep AIC_DSN_VLASNIK) \
     node alati/nalog.js dodaj ti@mejl.rs --rola admin
```

Lozinka se ispisuje **jednom**. DSN mora biti **vlasnicki**: rola `sajt` nema
`INSERT` nad `auth.korisnik`, i to je namerno -- proces okrenut internetu ne
treba da ume da napravi sebi nalog.

```
node alati/nalog.js lista
node alati/nalog.js rola <mejl> admin|gost
node alati/nalog.js ugasi <mejl>      # gasi i sve njegove zive sesije
node alati/nalog.js upali <mejl>
node alati/nalog.js lozinka <mejl>    # nova lozinka, sesije dole
node alati/nalog.js obrisi <mejl>
```

### 9. nginx i TLS

```bash
sudo cp /opt/aic-sajt/nginx-aic.conf /etc/nginx/sites-available/aic
sudo ln -sf /etc/nginx/sites-available/aic /etc/nginx/sites-enabled/aic
grep -Rn 'limit_req_zone' /etc/nginx/    # ako zona `prijava` vec postoji, preimenuj nasu
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d <ip-sa-crticama>.sslip.io
```

**Nikad `systemctl restart nginx`** dok na masini stoje i drugi sajtovi -- `reload`
sa losom konfiguracijom ne obara nginx koji radi, `restart` obara.

### 10. Rezerva

```bash
sudo chmod +x /opt/aic-sajt/rezerva.sh
(sudo crontab -l 2>/dev/null; echo "0 4 * * * /opt/aic-sajt/rezerva.sh") | sudo crontab -
```

---

## Osvezavanje

**Kod** (posle izmene, sa Maca `git push` pa na dropletu):

```bash
git -C /opt/aic-sajt pull
cd /opt/aic-sajt/server && npm ci --omit=dev   # samo ako se package.json menjao
sudo pm2 restart aic-sajt
```

**Podaci** (posle pipeline prolaza, sa Maca):

```bash
AIC_DROPLET=<ti>@<ip> deploy/objavi.sh
```

`objavi.sh` sam pusta `auth_schema.sql`, `cuvao_schema.sql` i `grants.sql` iz
`/opt/aic-sajt/baza/` posle vracanja -- `DROP SCHEMA public CASCADE` odnosi i
prava, pa se moraju vratiti. Ako si menjao kod, **prvo `git pull` pa onda
`objavi.sh`**, da skripta nadje sveze SQL fajlove.

---

## Zasto `dist` ide u git

Izmereno na ovom dropletu: 960 MB ukupno, **398 MB slobodno**, jedno jezgro, i
na njemu vec pet sajtova, MySQL i PM2 sa cetiri node procesa. `vite build` trazi
par stotina MB u vrhu; OOM killer bira zrtvu po velicini i to bi bio Postgres --
dakle svi sajtovi, ne samo ovaj.

Zato se gradi **na Macu** (`cd web && npm run build`), `dist/` se commituje, a
droplet radi samo `git pull`. Time mu ne treba ni `web/node_modules` (vite,
esbuild, ~150 MB), nego samo `server/` sa dve zavisnosti.

Cena je da posle svake izmene frontenda moras da pokrenes build pre commita.
Ako droplet ikad dobije 2 GB, obrni: `web/dist/` u `.gitignore` i gradi na serveru.

---

## Sta jos treba znati

- **Lozinke prelaze iz Python verzije bez migracije.** Isti zapis
  `scrypt$n$r$p$so$hes` sa parametrima u samom zapisu; Node ima `crypto.scrypt`
  u standardnoj biblioteci. Provereno u oba smera.
- **Rola `sajt` mora da sme `UPDATE (istice)` nad `auth.sesija`.** Klizni rok
  salje taj UPDATE na svakom zahtevu i kad ne pogodi nijedan red -- Postgres
  pravo proverava PRE `WHERE`. Bez toga prijava prodje a svaki sledeci zahtev
  vrati 500. Vec je u `baza/grants.sql`.
- **Snimak u "Sacuvano" uzima server, iz baze.** Klijent salje samo `vrsta` i
  `kljuc`; citat i izvor server procita sam. Inace bi svaki prijavljen korisnik
  mogao da upise izmisljenu recenicu sa izmisljenim izvorom.
- **Nivoi koji nisu nivoi** (`Budget Range`) su doslovan spisak u
  `server/src/podaci/nivoi-koji-nisu-nivoi.json`, generisan iz Pythona. Ne
  prepravljaj ga rucno -- `deploy/objavi.sh` ga osvezava i treba ga commitovati
  ovde.
- **`prepare_threshold` se ne postavlja** jer node-postgres ne priprema upite sam
  od sebe. Ako ikad prosledis `name` upitu, vraca se kvar iz Python verzije:
  206 ms prema 1.377 ms na `/api/ponuda/seo`.
