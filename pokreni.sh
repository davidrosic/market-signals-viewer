#!/usr/bin/env bash
# Pokretac za PM2. PM2 nema `EnvironmentFile` ni `User=`, pa oboje radi ovaj
# omotac:
#
#   1. cita AIC_DSN iz /etc/aic/sajt.env -- lozinka tako NIJE u ecosystem
#      fajlu, koji je u gitu;
#   2. spusta prava sa root-a na `aic` pre nego sto Node krene.
#
# Druga stavka je vazna jer PM2 na ovom dropletu radi kao root: bez nje bi sajt
# okrenut internetu bio root proces. PM2 se time NE menja -- menja se samo ovaj
# jedan proces. `setpriv` zamenjuje sam sebe (exec), pa PM2 i dalje prati tacan
# PID i `pm2 restart` radi normalno.
#
# Ako ipak hoces da radi kao root, kao ostali tvoji servisi: obrisi `exec
# setpriv ... --` ispred poslednjeg reda.
set -euo pipefail

ENVFAJL=${AIC_ENV:-/etc/aic/sajt.env}
KORISNIK=${AIC_KORISNIK:-aic}
KOREN=${AIC_KOREN:-/var/www/market-signals-viewer}

[ -r "$ENVFAJL" ] || { echo "ne mogu da procitam $ENVFAJL" >&2; exit 1; }
set -a; . "$ENVFAJL"; set +a
[ -n "${AIC_DSN:-}" ] || { echo "$ENVFAJL ne postavlja AIC_DSN" >&2; exit 1; }

cd "$KOREN/server"
[ -d node_modules ] || { echo "nema node_modules -- pokreni 'npm ci' u $KOREN/server" >&2; exit 1; }

if [ "$(id -u)" -eq 0 ] && id "$KORISNIK" >/dev/null 2>&1; then
    exec setpriv --reuid="$KORISNIK" --regid="$KORISNIK" --init-groups \
         --inh-caps=-all -- node src/index.js
fi
exec node src/index.js
