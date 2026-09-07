// Natpis u zaglavlju: mejl, promena lozinke, odjava.
import { useState } from 'react';

import { posalji } from '../api.js';

export default function Nalog({ ja, naOdjavu }) {
  const [otvoren, postavi] = useState(false);
  const [stara, postaviStaru] = useState('');
  const [nova, postaviNovu] = useState('');
  const [poruka, postaviPoruku] = useState('');

  const promeni = async (e) => {
    e.preventDefault();
    const d = await posalji('lozinka', { stara, nova });
    postaviPoruku(d?.greska || 'Password changed.');
    if (!d?.greska) { postaviStaru(''); postaviNovu(''); }
  };

  return (
    <div className="nalog">
      <span className="dim" title={ja.email}>{ja.email}</span>
      {ja.rola === 'admin' && <span className="tag">admin</span>}
      <button type="button" className="ghost" onClick={() => postavi((o) => !o)}>Password</button>
      <button type="button" className="ghost" onClick={naOdjavu}>Sign out</button>
      {otvoren && (
        <div className="izbornik on" style={{ right: '16px', top: '58px', left: 'auto', minWidth: '260px' }}>
          <form onSubmit={promeni}>
            <div className="iz-grp">Change password</div>
            <div className="iz-novi">
              <input
                type="password"
                placeholder="Current password"
                value={stara}
                onChange={(e) => postaviStaru(e.target.value)}
              />
            </div>
            <div className="iz-novi">
              <input
                type="password"
                placeholder="New password (min 12)"
                value={nova}
                onChange={(e) => postaviNovu(e.target.value)}
              />
            </div>
            <div className="iz-greska">{poruka}</div>
            <div className="iz-novi">
              <button type="submit" className="primary" disabled={!stara || !nova}>Change</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
