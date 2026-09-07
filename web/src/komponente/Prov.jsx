// Provenijencija: svaki podatak nosi izvor (CLAUDE.md, ogranicenje 4).
// Tacka pored broja otvara citat i URL sa kog je procitan.
import { useEffect, useRef, useState } from 'react';

export default function Prov({ url, method, citat }) {
  const [otvoren, postavi] = useState(false);
  const [gde, postaviGde] = useState({ left: 0, top: 0 });
  const tacka = useRef(null);

  // Tooltip mora da izadje iz svakog `overflow:hidden` roditelja (tabele,
  // kartice), pa se crta u fiksnom sloju nad stranom i pozicionira racunski.
  const pokazi = () => {
    const r = tacka.current?.getBoundingClientRect();
    if (!r) return;
    postaviGde({ left: Math.min(r.left, window.innerWidth - 450), top: r.bottom + 8 });
    postavi(true);
  };

  useEffect(() => {
    if (!otvoren) return undefined;
    const sakrij = () => postavi(false);
    // Skrol pomera tacku a tooltip ostaje -- zato se zatvara na skrol.
    window.addEventListener('scroll', sakrij, true);
    return () => window.removeEventListener('scroll', sakrij, true);
  }, [otvoren]);

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
        <span className="tip on" style={{ left: gde.left + 'px', top: gde.top + 'px' }}>
          {citat && <b>{'“' + String(citat).slice(0, 300) + '”'}</b>}
          <span className="u">{(method ? '[' + method + '] ' : '') + url}</span>
        </span>
      )}
    </>
  );
}

export function Link({ url, children }) {
  return <a href={url} target="_blank" rel="noopener noreferrer">{children}</a>;
}
