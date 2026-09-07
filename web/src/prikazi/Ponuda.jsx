// Jedna ponuda: ko je nudi, ko objavljuje cenu, i svaka cena kao zaseban
// podatak sa svojim dokazom. Histogram se crta ovde jer prag i sirina korpe
// zavise od toga sta se prikazuje -- server salje sirove tacke.
//
// Jedan grafikon PO JEDINICI: 2.000 mesecno i 2.000 po projektu nisu ista
// cena, i jedna raspodela preko svih jedinica daje medijanu koja ne opisuje
// nijednu od njih.
import { useState } from 'react';

import { $$, N, cap, imeP, pl, state } from '../api.js';
import { useUcitaj } from '../App.jsx';
import { Cuvaj } from '../komponente/Cuvano.jsx';
import Glava from '../komponente/Glava.jsx';
import Grafikon from '../komponente/Grafikon.jsx';
import Prov, { Link } from '../komponente/Prov.jsx';

function CeneTabela({ cene }) {
  return (
    <div className="wrap">
      <table>
        <thead>
          <tr>
            <th>Agency</th>
            <th className="r">Amount</th>
            <th>Unit</th>
            <th>Label</th>
            <th />
            <th />
          </tr>
        </thead>
        <tbody>
          {cene.map((c) => (
            <tr key={c.cena_id}>
              <td>
                <a href={'#/agency/' + c.id}>{c.ime}</a>
                <div className="dim mono tanko">{c.domain}</div>
              </td>
              <td className="r num">
                {c.od && <span className="dim">from </span>}
                {$$(c.iznos)}
                {c.iznos_do && c.iznos_do !== c.iznos && (
                  <span className="dim">{' – ' + $$(c.iznos_do)}</span>
                )}
              </td>
              <td>{c.jedinica ? <span className="tag q">{c.jedinica}</span> : <span className="dim">—</span>}</td>
              <td className="dim tanko">{c.label || c.vrsta || '—'}</td>
              <td><Prov url={c.source_url} method={c.method} citat={c.citat} /></td>
              <td className="r"><Cuvaj vrsta="cena" kljuc={'cena:' + c.cena_id} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Ponuda({ ime }) {
  const { radi, d } = useUcitaj('ponuda/' + encodeURIComponent(ime), [ime, state.grad]);
  const [izbor, postaviIzbor] = useState(null);

  if (radi) return <div className="load">Loading</div>;
  if (!d?.agencije) return <div className="empty">No data.</div>;

  const poJedinici = {};
  for (const c of d.cene) {
    const j = c.jedinica || 'unspecified';
    (poJedinici[j] ||= []).push(c);
  }
  const grupe = Object.entries(poJedinici).sort((a, b) => b[1].length - a[1].length);

  return (
    <>
      <Glava
        crumb={<a href="#/categories">Categories</a>}
        naslov={d.naziv}
        desno={(
          <>
            <span className="pill">{pl(d.agencije.length, 'agency', 'agencies')}</span>
            <Cuvaj vrsta="ponuda" kljuc={'ponuda:' + d.ponuda} />
          </>
        )}
      />
      <p className="note">
        {`${pl(d.cene.length, 'published price')} from agencies' own pages. Each price keeps its `}
        source and the sentence it was read from — hover the dot.
      </p>

      {grupe.length > 0 && (
        <div className="sec">
          <h2>Price distribution</h2>
          {grupe.map(([jedinica, cene]) => (
            <div className="chart" key={jedinica}>
              <div className="chart-h">
                <b>{`per ${jedinica}`}</b>
                <span className="dim">{pl(cene.length, 'price')}</span>
              </div>
              <Grafikon
                cene={cene}
                izabrana={izbor?.jedinica === jedinica ? izbor.natpis : null}
                naKlik={(redovi, natpis) => postaviIzbor({ jedinica, natpis, redovi })}
              />
            </div>
          ))}
          {izbor && (
            <div className="sec">
              <div className="head">
                <div><h2>{`${izbor.natpis} · per ${izbor.jedinica}`}</h2></div>
                <div className="head-desno">
                  <button type="button" className="ghost mali" onClick={() => postaviIzbor(null)}>
                    clear
                  </button>
                </div>
              </div>
              <CeneTabela cene={izbor.redovi} />
            </div>
          )}
        </div>
      )}

      <div className="sec">
        <h2>{`Agencies offering this (${N(d.agencije.length)})`}</h2>
        <div className="wrap">
          <table>
            <thead>
              <tr>
                <th>Agency</th>
                <th>Their name for it</th>
                <th>Category</th>
                <th />
                <th />
              </tr>
            </thead>
            <tbody>
              {d.agencije.map((a) => (
                <tr key={a.servis_id}>
                  <td>
                    <a href={'#/agency/' + a.id}>{a.ime}</a>
                    <div className="dim mono tanko">
                      <Link url={'https://' + a.domain}>{a.domain}</Link>
                    </div>
                  </td>
                  <td>
                    {a.naziv}
                    {a.opis && <div className="dim tanko">{String(a.opis).slice(0, 160)}</div>}
                  </td>
                  <td>{a.kategorija ? <span className="tag q">{cap(a.kategorija)}</span> : <span className="dim">—</span>}</td>
                  <td><Prov url={a.source_url} method={a.method} citat={a.opis} /></td>
                  <td className="r">
                    {a.opis && <Cuvaj vrsta="tekst" kljuc={'opis:' + a.servis_id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {d.cene.length > 0 && (
        <div className="sec">
          <h2>{`All prices (${N(d.cene.length)})`}</h2>
          <CeneTabela cene={d.cene} />
        </div>
      )}
    </>
  );
}
