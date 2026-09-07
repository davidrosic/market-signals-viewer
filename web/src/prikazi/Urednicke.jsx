// Kako pisu o cenama: trzisni proseci i tudje cene iz njihovih blogova. NIKAD
// se ne mesaju sa sopstvenim cenama -- to je bio najbrojniji kvar projekta.
// Ovde stoje zato sto pokazuju KAKO agencija govori o novcu.
import { $$, pl, state } from '../api.js';
import { useUcitaj } from '../App.jsx';
import Glava from '../komponente/Glava.jsx';
import Prov from '../komponente/Prov.jsx';

export default function Urednicke() {
  const { radi, d } = useUcitaj('urednicke', [state.grad]);
  if (radi) return <div className="load">Loading</div>;
  if (!Array.isArray(d) || !d.length) return <div className="empty">No data.</div>;
  return (
    <>
      <Glava naslov="Market talk" desno={<span className="pill">{pl(d.length, 'quote')}</span>} />
      <p className="note">
        Market averages and other people&apos;s prices, quoted in agency blog posts. These are
        <b> not</b> what the agency charges, and they never enter any figure elsewhere on this site.
        Mixing the two was the single most common defect in this data.
      </p>
      <div className="wrap">
        <table>
          <thead>
            <tr>
              <th>Agency</th>
              <th>About</th>
              <th className="r">Amount</th>
              <th>Unit</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {d.map((r, i) => (
              <tr key={i}>
                <td>
                  <a href={'#/agency/' + r.id}>{r.ime}</a>
                  <div className="dim mono tanko">{r.domain}</div>
                </td>
                <td>
                  {r.ponuda
                    ? <a href={'#/service/' + encodeURIComponent(r.ponuda)}>{r.naziv || r.ponuda}</a>
                    : <span className="dim">—</span>}
                </td>
                <td className="r num">
                  {$$(r.iznos)}
                  {r.iznos_do && r.iznos_do !== r.iznos && (
                    <span className="dim">{' – ' + $$(r.iznos_do)}</span>
                  )}
                </td>
                <td>{r.jedinica ? <span className="tag q">{r.jedinica}</span> : <span className="dim">—</span>}</td>
                <td><Prov url={r.source_url} citat={r.citat} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
