// Jedna agencija: kancelarije (SAMO kalifornijske), servisi, cene, kontakti,
// atributi, tehnologije, ljudi. Svaki podatak nosi izvor.
import { $$, N, cap, pl } from '../api.js';
import { useUcitaj } from '../App.jsx';
import { Cuvaj } from '../komponente/Cuvano.jsx';
import Glava from '../komponente/Glava.jsx';
import Prov, { Link } from '../komponente/Prov.jsx';

const IME_ATRIBUTA = {
  positioning: 'Positioning', team_size: 'Team size', white_label: 'White label',
  min_project: 'Minimum project', service_area: 'Service area',
  legal_name: 'Legal name', founded_year: 'Founded',
};

export default function Agencija({ id }) {
  const { radi, d } = useUcitaj('agencija/' + id, [id]);
  if (radi) return <div className="load">Loading</div>;
  if (!d || d.greska) return <div className="empty">{d?.greska || 'Not found.'}</div>;

  return (
    <>
      <Glava
        crumb={<Link url={'https://' + d.domain}>{d.domain}</Link>}
        naslov={d.ime}
        desno={(
          <>
            {d.grad && <span className="pill">{`${d.grad}${d.drzava ? ', ' + d.drzava : ''}`}</span>}
            <Cuvaj vrsta="agencija" kljuc={'agencija:' + d.id} />
          </>
        )}
      />
      {d.stranica != null && (
        <p className="note">{`${pl(d.stranica, 'page')} of their site were read.`}</p>
      )}

      {d.atributi?.length > 0 && (
        <div className="sec">
          <h2>How they describe themselves</h2>
          <div className="wrap">
            <table>
              <tbody>
                {d.atributi.map((a) => (
                  <tr key={a.atribut_id}>
                    <td style={{ width: '160px' }}><span className="dim">{IME_ATRIBUTA[a.kljuc] || cap(a.kljuc)}</span></td>
                    <td>{a.vrednost}</td>
                    <td><Prov url={a.source_url} method={a.method} citat={a.vrednost} /></td>
                    <td className="r">
                      {a.kljuc === 'positioning'
                        && <Cuvaj vrsta="tekst" kljuc={'pozicija:' + a.atribut_id} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {d.cene?.length > 0 && (
        <div className="sec">
          <h2>{`Published prices (${N(d.cene.length)})`}</h2>
          <div className="wrap">
            <table>
              <thead>
                <tr>
                  <th>Offering</th>
                  <th>Label</th>
                  <th className="r">Amount</th>
                  <th>Unit</th>
                  <th />
                  <th />
                </tr>
              </thead>
              <tbody>
                {d.cene.map((c) => (
                  <tr key={c.cena_id}>
                    <td>
                      {c.ponuda
                        ? <a href={'#/service/' + encodeURIComponent(c.ponuda)}>{c.naziv || c.ponuda}</a>
                        : <span className="dim">—</span>}
                    </td>
                    <td className="dim tanko">{c.label || '—'}</td>
                    <td className="r num">
                      {c.od && <span className="dim">from </span>}
                      {$$(c.iznos)}
                      {c.iznos_do && c.iznos_do !== c.iznos && (
                        <span className="dim">{' – ' + $$(c.iznos_do)}</span>
                      )}
                    </td>
                    <td>{c.jedinica ? <span className="tag q">{c.jedinica}</span> : <span className="dim">—</span>}</td>
                    <td><Prov url={c.source_url} method={c.method} citat={c.citat} /></td>
                    <td className="r"><Cuvaj vrsta="cena" kljuc={'cena:' + c.cena_id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {d.servisi?.length > 0 && (
        <div className="sec">
          <h2>{`Services (${N(d.servisi.length)})`}</h2>
          <div className="wrap">
            <table>
              <tbody>
                {d.servisi.map((s) => (
                  <tr key={s.servis_id}>
                    <td>
                      <b>{s.naziv}</b>
                      {s.opis && <div className="dim tanko">{String(s.opis).slice(0, 200)}</div>}
                    </td>
                    <td>
                      {s.ponuda && (
                        <a className="tanko" href={'#/service/' + encodeURIComponent(s.ponuda)}>{s.ponuda}</a>
                      )}
                    </td>
                    <td>{s.kategorija ? <span className="tag q">{cap(s.kategorija)}</span> : <span className="dim">—</span>}</td>
                    <td><Prov url={s.source_url} method={s.method} citat={s.opis} /></td>
                    <td className="r">
                      {s.opis && <Cuvaj vrsta="tekst" kljuc={'opis:' + s.servis_id} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="split">
        {d.kancelarije?.length > 0 && (
          <div className="sec">
            <h2>California offices</h2>
            <div className="card">
              <table>
                <tbody>
                  {d.kancelarije.map((o, i) => (
                    <tr key={i}>
                      <td>
                        {o.grad}
                        {o.sediste && <span className="tag q">HQ</span>}
                      </td>
                      <td className="dim">{o.drzava}</td>
                      <td><Prov url={o.source_url} method={o.method} citat={o.citat} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {d.kontakti?.length > 0 && (
          <div className="sec">
            <h2>Contacts</h2>
            <div className="card">
              <table>
                <tbody>
                  {d.kontakti.map((c, i) => (
                    <tr key={i}>
                      <td className="dim" style={{ width: '90px' }}>{cap(c.vrsta)}</td>
                      <td className="mono tanko">{c.vrednost}</td>
                      <td><Prov url={c.source_url} method={c.method} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {d.tehnologije?.length > 0 && (
        <div className="sec">
          <h2>Technology</h2>
          <div className="oznake">
            {d.tehnologije.map((t, i) => (
              <span className="tag q" key={i}>
                {t.naziv}
                {t.vrsta && <span className="dim">{' · ' + t.vrsta}</span>}
                <Prov url={t.source_url} />
              </span>
            ))}
          </div>
        </div>
      )}

      {d.ljudi?.length > 0 && (
        <div className="sec">
          <h2>{`People (${N(d.ljudi.length)})`}</h2>
          <p className="note">
            Names and titles from the agency&apos;s own public team page. Nothing is read from
            individual LinkedIn profiles.
          </p>
          <div className="wrap">
            <table>
              <tbody>
                {d.ljudi.map((p, i) => (
                  <tr key={i}>
                    <td>{p.ime}</td>
                    <td className="dim">{p.pozicija || '—'}</td>
                    <td><Prov url={p.source_url} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
