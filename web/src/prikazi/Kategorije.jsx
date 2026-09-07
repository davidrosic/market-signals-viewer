// Kategorija je gruba podela za snalazenje. Jedinica izvestaja je PONUDA --
// zato je ovde i broj ponuda koje nudi 3+ agencija, jer po njima se ide dalje.
import { N, cap, pl, state } from '../api.js';
import { useUcitaj } from '../App.jsx';
import Glava from '../komponente/Glava.jsx';

export default function Kategorije() {
  const { radi, d } = useUcitaj('kategorije', [state.grad]);
  if (radi) return <div className="load">Loading</div>;
  if (!Array.isArray(d) || !d.length) return <div className="empty">No data.</div>;
  return (
    <>
      <Glava
        naslov="Categories"
        desno={<span className="pill">{pl(d.length, 'category', 'categories')}</span>}
      />
      <p className="note">
        A category is a shelf, not a fact. Open one to see the services inside it — those are what
        agencies actually sell, under their own names.
      </p>
      <div className="grid g3">
        {d.map((r) => (
          <a className="card" href={'#/category/' + encodeURIComponent(r.kategorija)} key={r.kategorija}>
            <h3>{cap(r.kategorija)}</h3>
            <div className="muted tanko">
              {`${pl(r.agencija, 'agency', 'agencies')} · ${pl(r.ponuda, 'service')}`}
            </div>
            <div className="dim tanko">{`${N(r.ponuda_3plus)} offered by 3+ agencies`}</div>
          </a>
        ))}
      </div>
    </>
  );
}
