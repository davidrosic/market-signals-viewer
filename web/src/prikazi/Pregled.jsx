// Naslovna: koliko ih ima, kako se cene raspodeljuju po jedinici, i sta
// najveci broj agencija nudi.
import { $$, N, cap, imeP, state } from '../api.js';
import { useUcitaj } from '../App.jsx';
import { Cuvaj } from '../komponente/Cuvano.jsx';
import Glava from '../komponente/Glava.jsx';

export default function Pregled() {
  const { radi, d } = useUcitaj('pregled', [state.grad]);
  if (radi) return <div className="load">Loading</div>;
  if (!d?.osnovno) return <div className="empty">No data.</div>;
  const o = d.osnovno;
  const gde = state.grad || 'California';

  return (
    <>
      <Glava naslov="The LA agency market" desno={<span className="pill">{`scope: ${gde}`}</span>} />
      <p className="note">
        {`Everything here is read from agencies' own public pages. ${N(o.agencija)} agencies have `}
        {`at least one office in California; ${N(o.sa_cenom)} of them publish a price. Prices `}
        quoted from articles or competitors are never counted as an agency&apos;s own — those live
        under Market talk.
      </p>

      <div className="grid g4">
        <div className="card stat">
          <div className="k">Agencies</div>
          <div className="v num">{N(o.agencija)}</div>
          <div className="s">{gde}</div>
        </div>
        <div className="card stat">
          <div className="k">Publish a price</div>
          <div className="v num">{N(o.sa_cenom)}</div>
          <div className="s">{Math.round((100 * o.sa_cenom) / o.agencija) + '% of them'}</div>
        </div>
        <div className="card stat">
          <div className="k">Distinct services</div>
          <div className="v num">{N(o.ponuda)}</div>
          <div className="s">named as the agency writes them</div>
        </div>
        <div className="card stat">
          <div className="k">Categories</div>
          <div className="v num">{N(o.kategorija)}</div>
          <div className="s"><a href="#/categories">browse →</a></div>
        </div>
      </div>

      <div className="sec">
        <h2>What they charge, by billing model</h2>
        <p className="note">
          One agency counts once per amount. p90 rather than max: a single stray row should not
          define a range.
        </p>
        <div className="wrap">
          <table>
            <thead>
              <tr>
                <th>Unit</th>
                <th className="r">Agencies</th>
                <th className="r">Prices</th>
                <th className="r">Low</th>
                <th className="r">Median</th>
                <th className="r">p90</th>
              </tr>
            </thead>
            <tbody>
              {d.po_jedinici.map((r) => (
                <tr key={r.jedinica}>
                  <td><span className="tag">{'per ' + r.jedinica}</span></td>
                  <td className="r num">{N(r.agencija)}</td>
                  <td className="r num">{N(r.cena)}</td>
                  <td className="r num">{$$(r.lo)}</td>
                  <td className="r num">{$$(r.med)}</td>
                  <td className="r num">{$$(r.p90)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sec">
        <h2>Most widely offered services</h2>
        <div className="grid g3">
          {d.najsire.slice(0, 18).map((r) => (
            <div className="card" key={r.ponuda}>
              <div className="sac-vrh">
                <h3><a href={'#/service/' + encodeURIComponent(r.ponuda)}>{imeP(r)}</a></h3>
                <span className="head-desno">
                  <span className="tag q num">{N(r.agencija)}</span>
                  <Cuvaj vrsta="ponuda" kljuc={'ponuda:' + r.ponuda} />
                </span>
              </div>
              <div className="dim tanko">{cap(r.kategorija || 'no category')}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
