#!/usr/bin/env bash
# Izmena sajta -> droplet, jednom komandom. Pusta se NA MACU, iz sajt-node/:
#
#   ./posalji.sh "sta si promenio"
#   AIC_DROPLET=root@134.122.75.34 ./posalji.sh "sta si promenio"
#
# Sa AIC_DROPLET odmah i povuce i restartuje na dropletu; bez njega samo
# gurne u git, pa `git pull` uradis rucno.
#
# ZASTO OVA SKRIPTA POSTOJI: `web/dist/` je u gitu (droplet od 960 MB ne sme da
# gradi -- vidi README). To znaci da se izmena u `web/src/` NE VIDI dok se ne
# pokrene build. Bez ovoga se lako gurne izvor bez izgradjenog fajla, droplet
# povuce stari bundle, a `src` u repou tvrdi nesto drugo -- kvar koji se ne
# prijavljuje nigde, samo se sajt ne menja.
set -euo pipefail
cd "$(dirname "$0")"

PORUKA=${1:-}
[ -n "$PORUKA" ] || { echo "upotreba: ./posalji.sh \"poruka za commit\"" >&2; exit 2; }

echo "==> gradim frontend"
( cd web && npm run build )

# Server nema build korak, ali ima testove -- 0,5 s, pa nema razloga preskociti.
echo "==> testovi servera"
( cd server && npm test >/dev/null 2>&1 ) && echo "    prolaze" || {
  echo "    TESTOVI PADAJU -- ne saljem." >&2
  echo "    Pogledaj: cd server && npm test" >&2
  exit 1
}

if git diff --quiet && git diff --cached --quiet; then
  echo "==> nema izmena, nista se ne salje"
  exit 0
fi

echo "==> commit"
git add -A
git status --short | sed 's/^/    /'
git commit -q -m "$PORUKA"

if git remote | grep -q .; then
  echo "==> push"
  git push -q
else
  echo "==> nema remote-a, preskacem push"
  echo "    git remote add origin <url> && git push -u origin main"
  exit 0
fi

if [ -n "${AIC_DROPLET:-}" ]; then
  echo "==> droplet: pull i restart"
  KOREN=${AIC_KOREN:-/opt/aic-sajt}
  # `npm ci` samo kad se `package.json` stvarno menjao -- inace je to 20
  # sekundi po objavljivanju bez razloga.
  ssh "$AIC_DROPLET" bash -euo pipefail <<SSH
    cd "$KOREN"
    PRE=\$(md5sum server/package.json | cut -d' ' -f1)
    git pull -q
    POSLE=\$(md5sum server/package.json | cut -d' ' -f1)
    if [ "\$PRE" != "\$POSLE" ]; then
      echo "    package.json se promenio -- npm ci"
      ( cd server && npm ci --omit=dev --silent )
    fi
    # Statiku sluzi nginx pravo iz web/dist, pa je ona ziva vec posle pull-a;
    # restart je zbog servera.
    ${AIC_RESTART:-sudo -n pm2 restart aic-sajt} >/dev/null
    echo "    gotovo"
SSH
else
  echo "==> AIC_DROPLET nije postavljen; na dropletu:"
  echo "    cd /opt/aic-sajt && git pull && sudo pm2 restart aic-sajt"
fi

echo "==> gotovo"
