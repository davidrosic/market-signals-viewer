#!/usr/bin/env bash
# Rezervna kopija NA DROPLETU, iz crona jednom dnevno:
#   0 4 * * * /opt/aic/deploy/rezerva.sh
#
# Cuva se samo sema `auth`. Sve ostalo se ponovo posalje sa Maca jednim
# `objavi.sh`, pa su jedini nenadoknadivi podaci ovde spisak korisnika i ono
# sto su sacuvali (`auth.spisak`, `auth.stavka`) -- to nigde drugde ne postoji.
set -euo pipefail
# cron ne cita ~/.bashrc, isto kao neinteraktivni ssh.
set -a; . /etc/aic/vlasnik.env; set +a
FOLDER=/var/backups/aic
mkdir -p "$FOLDER"
pg_dump "$AIC_DSN_VLASNIK" --schema=auth -Fc \
    > "$FOLDER/auth-$(date +%Y%m%d).dump"
# Trideset dana unazad je vise nego dovoljno za tabelu od nekoliko redova.
find "$FOLDER" -name 'auth-*.dump' -mtime +30 -delete
