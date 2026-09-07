// Poredjenje gradova. Grad se bira po PRISUSTVU: agencija se pojavljuje pod
// svakim gradom u kom ima kancelariju, ne samo pod sedistem.
import { $$, N, pl } from '../api.js';
import { useUcitaj } from '../App.jsx';
import Glava from '../komponente/Glava.jsx';

export default function Gradovi() {
  const { radi, d } = useUcitaj('gradovi-poredjenje', []);
  if (radi) return <div className="load">Loading</div>;
  if (!Array.isArray(d) || !d.length) return <div className="empty">No data.</div>;
  return (
    <>
      <Glava naslov="Cities" desno={<span className="pill">{pl(d.length, 'city', 'cities')}</span>} />
      <p className="note">
        An agency appears under every city where it has an office, not only its headquarters.
        Medians are per unit; a blank cell means too few prices to say anything.
      </p>
      <div className="wrap">
        <table>
          <thead>
            <tr>
              <th>City</th>
              <th className="r">Agencies</th>
              <th className="r">With a price</th>
              <th className="r">Median / month</th>
              <th className="r">Median / project</th>
              <th className="r">Median / hour</th>
            </tr>
          </thead>
          <tbody>
            {d.map((r) => (
              <tr key={r.grad}>
                <td>{r.grad}</td>
                <td className="r num">{N(r.agencija)}</td>
                <td className="r num">{N(r.sa_cenom)}</td>
                <td className="r num">{r.med_mesec ? $$(r.med_mesec) : <span className="dim">—</span>}</td>
                <td className="r num">{r.med_projekat ? $$(r.med_projekat) : <span className="dim">—</span>}</td>
                <td className="r num">{r.med_sat ? $$(r.med_sat) : <span className="dim">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
