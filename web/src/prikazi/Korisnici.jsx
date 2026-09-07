// Uprava korisnicima. Nalog se OVDE NE PRAVI -- lozinka mora nekud da se
// ispise, pa to radi server/alati/nalog.js pod vlasnickom rolom. Rola `sajt`
// namerno nema INSERT nad auth.korisnik.
import { useEffect, useState } from 'react';

import { api, nezavisno, pl, posalji } from '../api.js';
import Glava from '../komponente/Glava.jsx';

export default function Korisnici() {
  const [d, postavi] = useState(null);
  const [poruka, postaviPoruku] = useState('');

  useEffect(() => { nezavisno(api('korisnici').then(postavi)); }, []);

  const promeni = async (telo) => {
    const r = await posalji('korisnici', telo);
    if (Array.isArray(r)) { postavi(r); postaviPoruku(''); }
    else postaviPoruku(r?.greska || 'nije uspelo');
  };

  if (!d) return <div className="load">Loading</div>;
  if (!Array.isArray(d)) return <div className="empty">{d.greska || 'No access.'}</div>;

  const kad = (v) => (v ? new Date(v).toISOString().slice(0, 16).replace('T', ' ') : '—');

  return (
    <>
      <Glava naslov="Users" desno={<span className="pill">{pl(d.length, 'account')}</span>} />
      <p className="note">
        Accounts are created from the command line, because the password is shown once and never
        again: <code className="mono">node alati/nalog.js dodaj mejl@primer.rs --rola admin</code>
      </p>
      {poruka && <div className="p-greska">{poruka}</div>}
      <div className="wrap">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th className="r">Live sessions</th>
              <th>Created</th>
              <th>Last sign-in</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {d.map((k) => (
              <tr key={k.id}>
                <td>{k.email}</td>
                <td>
                  <select value={k.rola} onChange={(e) => promeni({ id: k.id, rola: e.target.value })}>
                    <option value="gost">gost</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="r num">{k.sesija}</td>
                <td className="dim tanko">{kad(k.napravljen)}</td>
                <td className="dim tanko">{kad(k.poslednja_prijava)}</td>
                <td>
                  <button
                    type="button"
                    className={'ghost mali' + (k.aktivan ? ' on' : '')}
                    onClick={() => promeni({ id: k.id, aktivan: !k.aktivan })}
                  >
                    {k.aktivan ? 'on' : 'off'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
