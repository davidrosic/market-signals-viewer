// Ponude unutar jedne kategorije, sa pragom (koliko agencija bar mora da nudi).
import { useState } from 'react';

import { N, cap, imeP, pl, state } from '../api.js';
import { useUcitaj } from '../App.jsx';
import { Cuvaj } from '../komponente/Cuvano.jsx';
import Glava from '../komponente/Glava.jsx';

export default function Kategorija({ ime }) {
  const [prag, postaviPrag] = useState(3);
  const { radi, d } = useUcitaj(
    'kategorija/' + encodeURIComponent(ime) + '?prag=' + prag, [ime, prag, state.grad]);

  return (
    <>
      <Glava
        crumb={<a href="#/categories">Categories</a>}
        naslov={cap(ime)}
        desno={(
          <label className="slider">
            <span>offered by</span>
            <input
              type="range"
              min="1"
              max="20"
              value={prag}
              onChange={(e) => postaviPrag(Number(e.target.value))}
            />
            <b>{prag}</b>
            <span>+ agencies</span>
          </label>
        )}
      />
      <p className="note">
        The count belongs to the offering, not to the shelf: the same offering is filed under
        different categories by different agencies, so it is counted across all of them.
      </p>
      {radi && <div className="load">Loading</div>}
      {!radi && (!Array.isArray(d) || !d.length) && (
        <div className="empty">Nothing at this threshold.</div>
      )}
      {!radi && Array.isArray(d) && d.length > 0 && (
        <div className="wrap">
          <table>
            <thead>
              <tr>
                <th>Offering</th>
                <th className="r">Agencies</th>
                <th className="r">With a price</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.map((r) => (
                <tr key={r.ponuda}>
                  <td><a href={'#/service/' + encodeURIComponent(r.ponuda)}>{imeP(r)}</a></td>
                  <td className="r num">{N(r.agencija)}</td>
                  <td className="r num">{N(r.sa_cenom)}</td>
                  <td className="r"><Cuvaj vrsta="ponuda" kljuc={'ponuda:' + r.ponuda} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
