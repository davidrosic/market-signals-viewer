// Grafikoni su rucni SVG -- bez biblioteke. Dva oblika, po broju cena:
// histogram od 5 navise, tackice ispod toga.
import { $$, pl } from '../api.js';

// Ispod 5 cena histogram bi bio lazna raspodela -- svaka cena je tacka sa
// imenom agencije, i klik radi isto sto i klik na stubic.
function Tackice({ cene, naKlik }) {
  const W = 760; const H = 128; const P = { l: 46, r: 14, t: 22, b: 34 };
  const v = cene.map((c) => c.iznos);
  const lo = Math.min(...v); const hi = Math.max(...v);
  const x = (val) => (hi === lo ? (P.l + W - P.r) / 2
    : P.l + (W - P.l - P.r) * ((val - lo) / (hi - lo)));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img">
      <line className="ax" x1={P.l} y1={H - P.b} x2={W - P.r} y2={H - P.b} />
      {cene.map((c, i) => {
        const cx = x(c.iznos); const cy = H - P.b - 12 - (i % 3) * 17;
        return (
          <g key={c.cena_id ?? i} onClick={() => naKlik([c], $$(c.iznos))} style={{ cursor: 'pointer' }}>
            <circle className="d" cx={cx} cy={cy} r={6}>
              <title>{`${c.ime} · ${$$(c.iznos)}`}</title>
            </circle>
            <text x={cx} y={cy - 10} textAnchor="middle" fontSize="10">{$$(c.iznos)}</text>
          </g>
        );
      })}
      <text x={P.l} y={H - 10} textAnchor="start">{$$(lo)}</text>
      <text x={W - P.r} y={H - 10} textAnchor="end">{$$(hi)}</text>
    </svg>
  );
}

export default function Grafikon({ cene, naKlik, izabrana }) {
  if (!cene?.length) return null;
  if (cene.length < 5) return <Tackice cene={cene} naKlik={naKlik} />;

  const W = 760; const H = 220; const P = { l: 46, r: 14, t: 26, b: 30 };
  const v = cene.map((c) => c.iznos).sort((a, b) => a - b);
  const lo = v[0];
  // Osa ide do p90, a sve iznad ide u poslednju korpu "i vise". Bez toga jedan
  // red (rezultat klijenta, ne cena) rastegne osu i svih ostalih 40 cena se
  // sabije u jedan stubic. Ekstrem se NE krije: korpa je vidljiva, klikabilna
  // i izbrojana.
  const gornja = v[Math.floor(v.length * 0.9)] ?? v[v.length - 1];
  const hi = gornja > lo ? gornja : v[v.length - 1];
  const n = Math.min(12, Math.max(5, Math.round(Math.sqrt(v.length) * 1.3)));
  const sirina = (hi - lo) / n || 1;
  const preko = cene.filter((c) => c.iznos > hi);
  const korpe = Array.from({ length: n }, (_, i) => ({
    od: lo + i * sirina, do: lo + (i + 1) * sirina, redovi: [],
  }));
  if (preko.length) korpe.push({ od: hi, do: null, redovi: preko, rep: true });
  for (const c of cene) {
    if (c.iznos > hi) continue;
    let i = Math.floor((c.iznos - lo) / sirina);
    if (i >= n) i = n - 1;
    if (i < 0) i = 0;
    korpe[i].redovi.push(c);
  }
  const max = Math.max(...korpe.map((k) => k.redovi.length));
  const bw = (W - P.l - P.r) / korpe.length;
  const y = (c) => P.t + (H - P.t - P.b) * (1 - c / max);
  const med = v[Math.floor(v.length / 2)];

  // Medijana: linija kroz grafikon, natpis IZNAD polja crtanja. Dok je stajao
  // unutar, padao je preko stubica i nije se mogao procitati.
  const mx = Math.min(W - P.r, Math.max(P.l,
    P.l + (W - P.l - P.r) * ((Math.min(med, hi) - lo) / (hi - lo || 1))));
  const desno = mx > W - 120;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img">
      <line className="ax" x1={P.l} y1={H - P.b} x2={W - P.r} y2={H - P.b} />
      {korpe.map((k, i) => {
        if (!k.redovi.length) return null;
        const natpis = k.rep ? `${$$(k.od)} and above` : `${$$(k.od)} – ${$$(k.do)}`;
        return (
          <rect
            key={i}
            className={'b' + (izabrana === natpis ? ' on' : '')}
            x={P.l + i * bw + 1.5}
            y={y(k.redovi.length)}
            width={bw - 3}
            height={H - P.b - y(k.redovi.length)}
            rx={3}
            style={{ cursor: 'pointer' }}
            onClick={() => naKlik(k.redovi, natpis)}
          >
            <title>
              {k.rep ? `${k.redovi.length} above ${$$(k.od)}`
                : `${pl(k.redovi.length, 'agency', 'agencies')} · ${$$(k.od)}–${$$(k.do)}`}
            </title>
          </rect>
        );
      })}
      <text x={6} y={y(0) + 4}>0</text>
      <text x={6} y={y(max) + 4}>{max}</text>
      <text x={P.l} y={H - 10} textAnchor="start">{$$(lo)}</text>
      <text x={W - P.r} y={H - 10} textAnchor="end">{$$(hi) + (preko.length ? '+' : '')}</text>
      <line className="med" x1={mx} y1={P.t - 6} x2={mx} y2={H - P.b} />
      <text
        x={desno ? mx - 5 : mx + 5}
        y={P.t - 11}
        textAnchor={desno ? 'end' : 'start'}
        fill="var(--warm)"
        fontWeight="600"
      >
        {'median ' + $$(med)}
      </text>
    </svg>
  );
}
