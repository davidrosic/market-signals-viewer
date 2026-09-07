// Pretraga sa padajucim spiskom. Rezultat se ne trazi na svaki pritisak tastera
// nego posle kratke tisine -- inace jedan upit po slovu.
import { useEffect, useRef, useState } from 'react';

import { api, imeP, nezavisno, pl } from '../api.js';

export default function Pretraga({ grad }) {
  const [q, postaviQ] = useState('');
  const [d, postaviD] = useState(null);
  const kutija = useRef(null);

  useEffect(() => {
    if (q.trim().length < 2) { postaviD(null); return undefined; }
    const t = setTimeout(() => {
      nezavisno(api('trazi?q=' + encodeURIComponent(q.trim())).then(postaviD));
    }, 180);
    return () => clearTimeout(t);
  }, [q, grad]);

  useEffect(() => {
    const vanKlik = (e) => { if (!kutija.current?.contains(e.target)) postaviD(null); };
    document.addEventListener('mousedown', vanKlik);
    return () => document.removeEventListener('mousedown', vanKlik);
  }, []);

  const ima = d && ((d.ponude?.length ?? 0) + (d.agencije?.length ?? 0) > 0);

  return (
    <div className="search" ref={kutija}>
      <input
        type="search"
        placeholder="Search services or agencies…"
        autoComplete="off"
        value={q}
        onChange={(e) => postaviQ(e.target.value)}
      />
      {d && (
        <div className="qres on">
          {!ima && <div className="grp">No match</div>}
          {d.ponude?.length > 0 && <div className="grp">Services</div>}
          {d.ponude?.map((r) => (
            <a
              key={'p' + r.ponuda}
              href={'#/service/' + encodeURIComponent(r.ponuda)}
              onClick={() => { postaviD(null); postaviQ(''); }}
            >
              <b>{imeP(r)}</b>
              <span className="dim tanko">{' · ' + pl(r.agencija, 'agency', 'agencies')}</span>
            </a>
          ))}
          {d.agencije?.length > 0 && <div className="grp">Agencies</div>}
          {d.agencije?.map((r) => (
            <a
              key={'a' + r.id}
              href={'#/agency/' + r.id}
              onClick={() => { postaviD(null); postaviQ(''); }}
            >
              <b>{r.ime}</b>
              <span className="dim mono tanko">{' · ' + r.domain}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
