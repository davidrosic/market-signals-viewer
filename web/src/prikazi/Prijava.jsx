// Prijava. Nema samostalne registracije -- nalog pravi David sa CLI-ja
// (server/alati/nalog.js), jer se lozinka ispisuje jednom.
import { useEffect, useState } from 'react';

import { posalji } from '../api.js';

export default function Prijava({ naUspeh }) {
  const [email, postaviEmail] = useState('');
  const [lozinka, postaviLozinku] = useState('');
  const [greska, postaviGresku] = useState('');
  const [radi, postaviRadi] = useState(false);

  // Dok nema sesije, u zaglavlju ne stoji nista sto vodi u podatke. To NIJE
  // zastita -- kapija je na serveru -- nego izbegavanje praznih ekrana.
  useEffect(() => {
    document.body.classList.add('neprijavljen');
    return () => document.body.classList.remove('neprijavljen');
  }, []);

  const salji = async (e) => {
    e.preventDefault();
    postaviGresku('');
    postaviRadi(true);
    try {
      // `tiho`: bez njega bi pogresna lozinka (401) pozvala prikaz prijave iz
      // same prijave.
      const d = await posalji('prijava', { email, lozinka }, true);
      if (d?.email) naUspeh(d);
      else postaviGresku(d?.greska || 'pogresan mejl ili lozinka');
    } catch {
      postaviGresku('server ne odgovara');
    } finally {
      postaviRadi(false);
    }
  };

  return (
    <form className="prijava" onSubmit={salji}>
      <h1>LA Agency Market</h1>
      <p className="muted">Sign in to continue.</p>
      <input
        type="email"
        placeholder="Email"
        autoComplete="username"
        autoFocus
        value={email}
        onChange={(e) => postaviEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        value={lozinka}
        onChange={(e) => postaviLozinku(e.target.value)}
      />
      <div className="p-greska">{greska}</div>
      <button type="submit" className="primary" disabled={radi || !email || !lozinka}>
        {radi ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
