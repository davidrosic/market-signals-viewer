import { N, cap, pl, state } from '../api.js';
import { useUcitaj } from '../App.jsx';
import Glava from '../komponente/Glava.jsx';

export default function Tehnologije() {
  const { radi, d } = useUcitaj('tehnologije', [state.grad]);
  if (radi) return <div className="load">Loading</div>;
  if (!Array.isArray(d) || !d.length) return <div className="empty">No data.</div>;
  const max = Math.max(...d.map((r) => r.agencija));
  return (
    <>
      <Glava naslov="Technology" desno={<span className="pill">{pl(d.length, 'signal')}</span>} />
      <p className="note">
        Detected on the agency&apos;s own site. Shown when at least 3 agencies use it — below that
        it says more about one shop than about the market.
      </p>
      <div className="wrap">
        <table>
          <thead>
            <tr>
              <th>Technology</th>
              <th>Kind</th>
              <th className="r">Agencies</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {d.map((r, i) => (
              <tr key={i}>
                <td>{r.naziv}</td>
                <td>{r.vrsta ? <span className="tag q">{cap(r.vrsta)}</span> : <span className="dim">—</span>}</td>
                <td className="r num">{N(r.agencija)}</td>
                <td style={{ width: '30%' }}>
                  <span className="bar-mini" style={{ width: (100 * r.agencija / max) + '%' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
