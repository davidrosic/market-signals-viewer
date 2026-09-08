// Dugme "sacuvaj" i izbornik spiskova.
//
// Klijent salje SAMO vrsta + kljuc. Naziv, iznos, citat, source_url i method
// server procita iz baze. Da telo zahteva sme da donese citat, svaki prijavljen
// korisnik bi mogao da upise izmisljenu recenicu sa izmisljenim izvorom -- i
// provenijencija bi na strani "Sacuvano" znacila nesto drugo nego svuda drugde.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { api, nezavisno, posalji } from '../api.js';
import Nadsloj from './Nadsloj.jsx';

const Kontekst = createContext(null);
export const useCuvano = () => useContext(Kontekst);

export function CuvanoProvider({ children, prijavljen }) {
  const [stavke, postaviStavke] = useState([]);
  const [spiskovi, postaviSpiskove] = useState([]);

  const upisi = useCallback((d) => {
    if (d?.stavke) postaviStavke(d.stavke);
    if (d?.spiskovi) postaviSpiskove(d.spiskovi);
  }, []);

  useEffect(() => {
    if (!prijavljen) { postaviStavke([]); postaviSpiskove([]); return; }
    nezavisno(api('cuvano').then(upisi));
  }, [prijavljen, upisi]);

  // 'vrsta|kljuc' -> [{id, spisak_id, moja}]. Dugme mora da zna gde je vec
  // sacuvano, jer je isti podatak moguce staviti i sebi i na vise spiskova.
  const indeks = useMemo(() => {
    const m = new Map();
    for (const s of stavke) {
      const k = s.vrsta + '|' + s.kljuc;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push({ id: s.id, spisak_id: s.spisak_id, moja: s.moja });
    }
    return m;
  }, [stavke]);

  return (
    <Kontekst.Provider value={{ stavke, spiskovi, indeks, upisi }}>
      {children}
    </Kontekst.Provider>
  );
}

export function Cuvaj({ vrsta, kljuc }) {
  const c = useCuvano();
  const [otvoren, postavi] = useState(false);
  const [novi, postaviNovi] = useState('');
  const [greska, postaviGresku] = useState('');
  const [radi, postaviRadi] = useState(false);
  const dugme = useRef(null);
  const meni = useRef(null);

  const mesta = c?.indeks.get(vrsta + '|' + kljuc) || [];
  const sacuvano = mesta.length > 0;

  // Skrol i promenu velicine hvata Nadsloj -- tamo je i polozaj koji oni kvare.
  const zatvori = useCallback(() => postavi(false), []);

  useEffect(() => {
    if (!otvoren) return undefined;
    // `meni` sada pokazuje na cvor u <body>, pa `contains` i dalje radi: klik
    // U izborniku ga ne zatvara, klik bilo gde drugde zatvara.
    const vanKlik = (e) => {
      if (!meni.current?.contains(e.target) && !dugme.current?.contains(e.target)) postavi(false);
    };
    const esc = (e) => { if (e.key === 'Escape') postavi(false); };
    document.addEventListener('mousedown', vanKlik);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', vanKlik);
      document.removeEventListener('keydown', esc);
    };
  }, [otvoren]);

  if (!c) return null;

  const otvori = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (otvoren) { postavi(false); return; }
    postaviGresku('');
    postavi(true);
  };

  const radnja = async (f) => {
    postaviRadi(true);
    postaviGresku('');
    try {
      await f();
    } catch (e) {
      postaviGresku(String(e?.message || e));
    } finally {
      postaviRadi(false);
    }
  };

  const prebaci = (spisakId) => radnja(async () => {
    const vec = mesta.find((g) => g.spisak_id === spisakId);
    // Uklanja samo onaj ko je dodao -- na zajednickom spisku stavka stoji
    // jednom, pa bi inace jedan korisnik mogao da isprazni tudji rad.
    if (vec && !vec.moja) { postaviGresku('dodao je neko drugi'); return; }
    const d = vec
      ? await posalji('cuvano/ukloni', { id: vec.id })
      : await posalji('cuvano', { vrsta, kljuc, spisak_id: spisakId ?? undefined });
    if (d?.greska) { postaviGresku(d.greska); return; }
    c.upisi(d);
    postavi(false);
  });

  const napraviPa = () => radnja(async () => {
    const ime = novi.trim();
    if (!ime) return;
    const d = await posalji('spiskovi', { naziv: ime });
    if (d?.greska) { postaviGresku(d.greska); return; }
    postaviNovi('');
    if (d?.spisak?.id) {
      const p = await posalji('cuvano', { vrsta, kljuc, spisak_id: d.spisak.id });
      if (p?.greska) { postaviGresku(p.greska); return; }
      c.upisi(p);
    } else c.upisi(d);
    postavi(false);
  });

  return (
    <>
      <button
        ref={dugme}
        type="button"
        className={'cuvaj' + (sacuvano ? ' on' : '')}
        title={sacuvano ? 'Saved — click to manage' : 'Save'}
        aria-label="Save"
        disabled={radi}
        onClick={otvori}
      >
        {sacuvano ? '★' : '☆'}
      </button>
      {otvoren && (
        <Nadsloj sidro={dugme} nutar={meni} klasa="izbornik on" naZatvaranje={zatvori}>
          <div className="iz-grp">Save to</div>
          <button
            type="button"
            className={'iz-red' + (mesta.some((g) => g.spisak_id === null) ? ' on' : '')}
            onClick={() => prebaci(null)}
          >
            <span className="iz-kv">{mesta.some((g) => g.spisak_id === null) ? '✓' : ''}</span>
            <span>Just me</span>
          </button>
          {c.spiskovi.map((s) => {
            const vec = mesta.find((g) => g.spisak_id === s.id);
            const tudja = vec && !vec.moja;
            return (
              <button
                key={s.id}
                type="button"
                className={'iz-red' + (vec ? ' on' : '')}
                disabled={tudja}
                title={tudja ? 'Added by someone else — only they can remove it' : undefined}
                onClick={() => prebaci(s.id)}
              >
                <span className="iz-kv">{vec ? '✓' : ''}</span>
                <span>{s.naziv}</span>
                <span className="tag q num">{s.stavki}</span>
              </button>
            );
          })}
          <div className="iz-greska">{greska}</div>
          <div className="iz-novi">
            <input
              value={novi}
              placeholder="New list…"
              onChange={(e) => postaviNovi(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') napraviPa(); }}
            />
          </div>
        </Nadsloj>
      )}
    </>
  );
}
