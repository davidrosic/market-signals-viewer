// Provenijencija: svaki podatak nosi izvor (CLAUDE.md, ogranicenje 4).
// Tacka pored broja otvara citat i URL sa kog je procitan.
import { useCallback, useRef, useState } from 'react';

import Nadsloj from './Nadsloj.jsx';

export default function Prov({ url, method, citat }) {
  const [otvoren, postavi] = useState(false);
  const tacka = useRef(null);

  // Oblacic mora da izadje iz svakog `overflow:hidden` roditelja (tabele,
  // kartice) -- zato Nadsloj, koji ga crta portalom u <body> i namesta po
  // IZMERENOJ velicini. Ranije je racun ovde bio `top: r.bottom + 8` bez
  // ijedne gornje granice, pa je citat od 300 znakova kod tacke pri dnu strane
  // ispadao ispod ruba prozora, a `pointer-events:none` znaci da se do njega
  // nije moglo ni doskrolovati.
  const zatvori = useCallback(() => postavi(false), []);
  const pokazi = () => postavi(true);

  if (!url) return null;
  return (
    <>
      <span
        ref={tacka}
        className="prov-dot"
        tabIndex={0}
        onMouseEnter={pokazi}
        onFocus={pokazi}
        onMouseLeave={() => postavi(false)}
        onBlur={() => postavi(false)}
      />
      {otvoren && (
        <Nadsloj sidro={tacka} klasa="tip on" slojKlasa="vrh" naZatvaranje={zatvori}>
          {citat && <b>{'“' + String(citat).slice(0, 300) + '”'}</b>}
          <span className="u">{(method ? '[' + method + '] ' : '') + url}</span>
        </Nadsloj>
      )}
    </>
  );
}

export function Link({ url, children }) {
  return <a href={url} target="_blank" rel="noopener noreferrer">{children}</a>;
}
