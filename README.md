# sajt-node

Sajt nad bazom: **Node 20 + Express** (backend) i **React + Vite** (frontend).
Zamena za `aic/sajt.py` i `aic/sajt_static/`, koji ostaju dok se ovo ne uhoda.

Pipeline se ne dira. On je i dalje Python (`aic/`), radi kod kuce, i puni bazu.
Ovaj sajt je samo citac: rola `sajt` nad semom `public` ima **samo SELECT**.

```
sajt-node/
  server/           Express, cist JS, dve zavisnosti (express, pg)
    src/            index.js, rute.js, upiti.js, auth.js, cuvano.js, db.js, sigurnost.js
    alati/nalog.js  pravljenje i uprava nalozima  <- ovo ti treba za prvi nalog
    test/           deset testova, 0,5 s
  web/              React + Vite
    src/prikazi/    jedanaest prikaza, isti kao stari sajt
    dist/           IZGRADJENO, i ide u git (vidi nize)
  pokreni.sh        omotac za PM2: cita /etc/aic/sajt.env, spusta prava
  ecosystem.config.cjs
  alati/izvezi-nivoe.py
```

## Prvi nalog

Nema samostalne registracije -- to je najveci deo zastite. Nalog pravis ti:

```bash
cd /opt/aic/sajt-node/server
sudo -u aic env $(sudo cat /etc/aic/vlasnik.env) node alati/nalog.js dodaj ti@mejl.rs --rola admin
```

Lozinka se ispisuje **jednom**. DSN mora biti **vlasnicki** (rola `aic`), ne
onaj iz `sajt.env`: rola `sajt` nema `INSERT` nad `auth.korisnik`, i to je
namerno -- proces okrenut internetu ne treba da ume da napravi sebi nalog.

Ostale komande:

```
node alati/nalog.js lista
node alati/nalog.js rola <mejl> admin|gost
node alati/nalog.js ugasi <mejl>      # gasi i sve njegove zive sesije
node alati/nalog.js upali <mejl>
node alati/nalog.js lozinka <mejl>    # nova lozinka, sesije dole
node alati/nalog.js obrisi <mejl>
```

Rolu i pristup mozes menjati i sa sajta, tab **Users** (samo admin). Nalog se
tamo ne pravi -- lozinka mora nekud da se ispise.

## Postavljanje

```bash
sudo mkdir -p /opt/aic /var/log/aic && sudo chown $USER:aic /opt/aic
git clone <repo> /opt/aic          # ili: git -C /opt/aic pull
cd /opt/aic/sajt-node/server && npm ci --omit=dev
```

`/etc/aic/sajt.env` (chmod 640, root:aic):
```
AIC_DSN=postgresql://sajt:<lozinka>@127.0.0.1:5432/aic
```

```bash
sudo pm2 start /opt/aic/sajt-node/ecosystem.config.cjs
sudo pm2 save
sudo pm2 install pm2-logrotate     # bez ovoga logovi rastu bez granice
```

nginx: `root /opt/aic/sajt-node/web/dist;` i `/api/` na `127.0.0.1:8770`.
Ostatak (TLS, limit_req, zaglavlja) je u `deploy/nginx-aic.conf`.

## Osvezavanje

```bash
git -C /opt/aic pull
cd /opt/aic/sajt-node/server && npm ci --omit=dev   # samo ako se package.json menjao
sudo pm2 restart aic-sajt
```

## Zasto `dist` ide u git

Izmereno na ovom dropletu: 960 MB ukupno, **398 MB slobodno**, jedno jezgro, i
na njemu vec pet sajtova, MySQL i PM2 sa cetiri node procesa. `vite build`
trazi par stotina MB u vrhu; OOM killer bira zrtvu po velicini i to bi bio
Postgres -- dakle svi sajtovi, ne samo ovaj.

Zato se gradi **na Macu** (`cd web && npm run build`), `dist/` se commituje, a
droplet radi samo `git pull`. Time mu ne treba ni `web/node_modules` (vite,
esbuild, ~150 MB), nego samo `server/` sa dve zavisnosti.

Cena je da posle svake izmene frontenda moras da pokrenes build pre commita.
Ako droplet ikad dobije 2 GB, obrni: dodaj `web/dist/` u `.gitignore` i gradi
na serveru.

## Sta je preneto iz Python verzije

Sve. Provereno poredjenjem odgovora **ruta po ruta** izmedju starog i novog
servera nad istom bazom -- 12 ruta, isti podaci do poslednjeg polja.

- 11 prikaza: Overview, Categories, Category, Service, Agency, Cities,
  Technology, Packaging, Market talk, Saved, Users
- pretraga sa padajucim spiskom, globalni filter grada, svetla/tamna tema
- provenijencija na svakom podatku (tacka -> citat + izvorni URL)
- histogram po jedinici (i tackice ispod 5 cena), klik na korpu
- Sacuvano: zabeleske i primeri, spiskovi, idempotentan upis
- prijava, promena lozinke, uprava korisnicima

Lozinke **prelaze bez migracije**: isti `scrypt$n$r$p$so$hes` zapis, a Node ima
`crypto.scrypt` u standardnoj biblioteci. Provereno u oba smera -- Node cita
hes koji je napravio Python i obrnuto.

## Sta je namerno drugacije

- **`prepare_threshold`.** Python verzija je morala da gasi pripremu upita: psycopg
  posle petog izvrsavanja pravi PREPARE, Postgres predje na genericki plan i
  `/api/ponuda/seo` je sa 206 ms skakalo na 1.377 ms. node-postgres ne priprema
  upite sam od sebe, pa se to ne moze desiti -- i zato se `name` ne koristi ni
  u jednom upitu.
- **Nivoi koji nisu nivoi.** `Budget Range` nije nivo cenovnika. Sud donosi
  Python (`ponuda.je_samo_iznos`), a ovde stoji samo REZULTAT, kao doslovan
  spisak (`server/src/podaci/nivoi-koji-nisu-nivoi.json`, 82 od 2.782 naziva).
  Port te funkcije u JS bi bio kopija domenske logike koja se vremenom razidje.
  Osvezava se sa `python sajt-node/alati/izvezi-nivoe.py` posle promene podataka.
- **Deset testova umesto 110.** Testira se ono gde greska pravi rupu, a ne ruzan
  ekran: kapija, zastavice na kolacicu, poreklo, i to da snimak dolazi iz baze
  a ne iz tela zahteva.
