#!/usr/bin/env python3
"""
Izvozi spisak naziva nivoa koji su zapravo rec za IZNOS (`Budget Range`,
`Average Cost`), da ih Node strana moze da izbaci iz prikaza "Pakovanje".

Zasto spisak a ne port funkcije: sud donosi `ponuda.je_samo_iznos`, koja se
oslanja na `kljuc_ponude` i cetiri konstante. Prepisivanje toga u JS bi bila
KOPIJA domenske logike, a kopije se vremenom raziđu -- isto upozorenje zbog
kog `cuvano.CENA_USLOV` ima test koji ga poredi sa `sajt.py`. Skup je konacan
i poznat (82 od 2.782 naziva), a CLAUDE.md, ogranicenje 6: doslovan spisak je
bolji od obrasca kad je skup takav. Spisak gresi samo na onome sto u njemu pise.

Pusta se na Macu, posle svakog pipeline prolaza (i iz `deploy/objavi.sh`):

    python sajt-node/alati/izvezi-nivoe.py
"""
import json
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))

import psycopg
from psycopg.rows import dict_row

from aic.ponuda import je_samo_iznos, kljuc_ponude

IZLAZ = (pathlib.Path(__file__).resolve().parents[1]
         / "server" / "src" / "podaci" / "nivoi-koji-nisu-nivoi.json")

UPIT = """
    SELECT DISTINCT coalesce(p.label, p.offering) AS nivo
      FROM price_point p
     WHERE NOT p.is_editorial
       AND coalesce(p.currency, 'USD') = 'USD'
       AND p.amount_min IS NOT NULL
       AND p.confidence >= 0.5
       AND p.unit IS NOT NULL
       AND coalesce(p.label, p.offering) IS NOT NULL
"""


def main() -> int:
    dsn = os.environ.get("AIC_DSN", "postgresql://aic:aic@localhost:5433/aic")
    with psycopg.connect(dsn, row_factory=dict_row) as c:
        nazivi = [r["nivo"] for r in c.execute(UPIT).fetchall()]
    lose = sorted({n for n in nazivi if je_samo_iznos(kljuc_ponude(n))})
    IZLAZ.parent.mkdir(parents=True, exist_ok=True)
    # Poredi se po malim slovima, pa se tako i upisuje -- da Node ne mora da
    # zna nista osim `Set.has`.
    IZLAZ.write_text(json.dumps(sorted({n.strip().lower() for n in lose}),
                                ensure_ascii=False, indent=1) + "\n")
    print(f"{IZLAZ.name}: {len(lose)} naziva od {len(set(nazivi))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
