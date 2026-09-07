// Kako pakuju ponudu: agencije koje objavljuju NIZ cena u istoj jedinici -- to
// je cenovnik sa nivoima. Ime nivoa vazi samo kod te agencije, ali obrazac
// pakovanja je upravo ono sto projekat trazi: kako prodaju, ne samo sta.
import { $$, pl, state } from '../api.js';
import { useUcitaj } from '../App.jsx';
import { Cuvaj } from '../komponente/Cuvano.jsx';
import Glava from '../komponente/Glava.jsx';
import Prov, { Link } from '../komponente/Prov.jsx';

export default function Paketi() {
  const { radi, d } = useUcitaj('paketi', [state.grad]);
  if (radi) return <div className="load">Loading</div>;
  if (!Array.isArray(d) || !d.length) return <div className="empty">No tiered pricing found.</div>;
  return (
    <>
      <Glava
        naslov="Packaging"
        desno={<span className="pill">{pl(d.length, 'price list')}</span>}
      />
      <p className="note">
        Agencies that publish a ladder of prices in the same unit. Tier names are theirs and mean
        nothing outside their own site — the ladder is the point, not the labels.
      </p>
      <div className="grid g2">
        {d.map((a) => (
          <div className="card" key={a.id + '-' + a.jedinica}>
            <div className="sac-vrh">
              <h3><a href={'#/agency/' + a.id}>{a.ime}</a></h3>
              <span className="head-desno">
                <span className="tag q">{`${a.nivoa} tiers · per ${a.jedinica}`}</span>
                <Cuvaj vrsta="agencija" kljuc={'agencija:' + a.id} />
              </span>
            </div>
            <div className="dim mono tanko">
              <Link url={'https://' + a.domain}>{a.domain}</Link>
            </div>
            <table>
              <tbody>
                {a.nivoi.map((n) => (
                  <tr key={n.cena_id}>
                    <td>{n.nivo}</td>
                    <td className="r num"><b>{$$(n.iznos)}</b></td>
                    <td><Prov url={n.source_url} citat={n.citat} /></td>
                    <td className="r"><Cuvaj vrsta="cena" kljuc={'cena:' + n.cena_id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </>
  );
}
