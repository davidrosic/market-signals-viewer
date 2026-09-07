import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api, nezavisno, posalji, pratiOdjavu, state, NEPRIJAVLJEN } from './api.js';
import { CuvanoProvider } from './komponente/Cuvano.jsx';
import Prijava from './prikazi/Prijava.jsx';
import Nalog from './prikazi/Nalog.jsx';
import Pregled from './prikazi/Pregled.jsx';
import Kategorije from './prikazi/Kategorije.jsx';
import Kategorija from './prikazi/Kategorija.jsx';
import Ponuda from './prikazi/Ponuda.jsx';
import Agencija from './prikazi/Agencija.jsx';
import Gradovi from './prikazi/Gradovi.jsx';
import Tehnologije from './prikazi/Tehnologije.jsx';
import Paketi from './prikazi/Paketi.jsx';
import Urednicke from './prikazi/Urednicke.jsx';
import Sacuvano from './prikazi/Sacuvano.jsx';
import Korisnici from './prikazi/Korisnici.jsx';
import Pretraga from './prikazi/Pretraga.jsx';

// Iste #/ adrese kao stari sajt -- postojeci linkovi i zabeleske i dalje rade.
const RUTE = [
  [/^\/?$/, () => <Pregled />],
  [/^\/categories$/, () => <Kategorije />],
  [/^\/category\/(.+)$/, (m) => <Kategorija ime={decodeURIComponent(m[1])} />],
  [/^\/service\/(.+)$/, (m) => <Ponuda ime={decodeURIComponent(m[1])} />],
  [/^\/agency\/(\d+)$/, (m) => <Agencija id={m[1]} />],
  [/^\/cities$/, () => <Gradovi />],
  [/^\/tech$/, () => <Tehnologije />],
  [/^\/packaging$/, () => <Paketi />],
  [/^\/market-talk$/, () => <Urednicke />],
  [/^\/cuvano$/, () => <Sacuvano />],
  [/^\/users$/, () => <Korisnici />],
];

const TABOVI = [
  ['#/', 'Overview'],
  ['#/categories', 'Categories'],
  ['#/cities', 'Cities'],
  ['#/packaging', 'Packaging'],
  ['#/tech', 'Technology'],
  ['#/market-talk', 'Market talk'],
  ['#/cuvano', 'Saved'],
];

function putanja() {
  return decodeURIComponent(window.location.hash.replace(/^#/, '')) || '/';
}

export default function App() {
  const [ja, postaviJa] = useState(undefined);   // undefined = jos se proverava
  const [put, postaviPut] = useState(putanja);
  const [grad, postaviGrad] = useState('');
  const [gradovi, postaviGradove] = useState([]);
  const [tema, postaviTemu] = useState(() => {
    try { return localStorage.getItem('aic-tema') || 'light'; } catch { return 'light'; }
  });

  // Odjava usred rada (nalog ugasen, sesija istekla) vraca na prijavu odmah.
  useEffect(() => pratiOdjavu(() => postaviJa(null)), []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    try { localStorage.setItem('aic-tema', tema); } catch { /* privatni prozor */ }
  }, [tema]);

  useEffect(() => {
    const f = () => postaviPut(putanja());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);

  // Pregledac sam vraca staru poziciju skrola pri promeni hasha; sa asinhronim
  // prikazom to znaci da strana zavrsi na 400px od vrha.
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [put]);

  useEffect(() => {
    api('ja', { tiho: true }).then((d) => postaviJa(d?.email ? d : null)).catch(() => postaviJa(null));
  }, []);

  useEffect(() => {
    if (!ja) return;
    nezavisno(api('gradovi').then((d) => postaviGradove(Array.isArray(d) ? d : [])));
  }, [ja]);

  // Grad je globalni filter: menja SVE prikaze, pa stoji u modulu (state.grad)
  // odakle ga api() cita, a ovde samo primorava ponovno crtanje.
  const promeniGrad = useCallback((g) => {
    state.grad = g;
    postaviGrad(g);
  }, []);

  const odjava = async () => {
    await posalji('odjava', {}, true).catch(() => {});
    postaviJa(null);
  };

  const prikaz = useMemo(() => {
    for (const [re, f] of RUTE) {
      const m = put.match(re);
      if (m) return f(m);
    }
    return <div className="empty">Nothing here.</div>;
  }, [put]);

  if (ja === undefined) return <div className="load">Loading</div>;
  if (ja === null) {
    // Zaglavlje ostaje (marka), ali pretraga, grad, tabovi i podnozje odlaze --
    // `body.neprijavljen` u CSS-u. To NIJE zastita nego izbegavanje praznih
    // ekrana; kapija je na serveru.
    return (
      <>
        <header className="top">
          <a className="brand" href="#/">
            <span className="brand-mark" />
            <span className="brand-text">LA Agency Market<em>California only</em></span>
          </a>
        </header>
        <main className="view"><Prijava naUspeh={postaviJa} /></main>
      </>
    );
  }

  const aktivan = (h) => h === '#' + put
    || (put.startsWith('/categor') && h === '#/categories')
    || (put.startsWith('/service') && h === '#/categories');

  return (
    <CuvanoProvider prijavljen={Boolean(ja)}>
      <header className="top">
        <a className="brand" href="#/">
          <span className="brand-mark" />
          <span className="brand-text">LA Agency Market<em>California only</em></span>
        </a>
        <div className="top-tools">
          <Pretraga grad={grad} />
          <label className="city">
            <span>City</span>
            <select value={grad} onChange={(e) => promeniGrad(e.target.value)}>
              <option value="">All California</option>
              {gradovi.map((g) => (
                <option key={g.grad} value={g.grad}>{`${g.grad} (${g.agencija})`}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="ghost"
            title="Light / dark"
            onClick={() => postaviTemu((t) => (t === 'dark' ? 'light' : 'dark'))}
          >
            ◐
          </button>
          <Nalog ja={ja} naOdjavu={odjava} />
        </div>
      </header>

      <nav className="tabs">
        {TABOVI.map(([h, ime]) => (
          <a key={h} href={h} className={aktivan(h) ? 'on' : undefined}>{ime}</a>
        ))}
        {ja.rola === 'admin' && (
          <a href="#/users" className={aktivan('#/users') ? 'on' : undefined}>Users</a>
        )}
      </nav>

      <main className="view">{prikaz}</main>

      <footer className="foot">
        <span>
          Every figure is read from an agency&apos;s own public pages. Hover any
          {' '}<span className="prov-dot" />{' '}to see the source URL and the exact quote.
        </span>
      </footer>
    </CuvanoProvider>
  );
}

// Zajednicki omotac za prikaze: ucitavanje, greska, prazan skup. Bez njega bi
// svaki prikaz imao svoja tri stanja i sva bi izgledala malo drugacije.
export function useUcitaj(putanjaApi, zavisnosti = []) {
  const [stanje, postavi] = useState({ radi: true, d: null, greska: null });
  const zadnji = useRef(0);
  useEffect(() => {
    const moj = ++zadnji.current;
    postavi({ radi: true, d: null, greska: null });
    api(putanjaApi)
      .then((d) => { if (moj === zadnji.current) postavi({ radi: false, d, greska: d?.greska || null }); })
      .catch((e) => {
        if (e === NEPRIJAVLJEN) return;
        if (moj === zadnji.current) postavi({ radi: false, d: null, greska: String(e.message || e) });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, zavisnosti);
  return stanje;
}
