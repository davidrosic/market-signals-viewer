// Sacuvano: zabeleske i primeri.
//
// Snimak je iz trenutka cuvanja i ostaje citljiv i kad red na koji kljuc
// pokazuje nestane -- takva stavka je obelezena kao "no longer in the data".
// Bez toga bi "sacuvano" znacilo "sacuvano dok se podaci ne osveze".
//
// Server salje sve stavke odjednom, a filtriranje je ovde: prelazak sa spiska
// na spisak ne trazi nov zahtev.
import { useMemo, useState } from 'react';

import { $$, pl, posalji } from '../api.js';
import { useCuvano } from '../komponente/Cuvano.jsx';
import Glava from '../komponente/Glava.jsx';
import Prov from '../komponente/Prov.jsx';

const IME_VRSTE = {
  agencija: 'Agency', ponuda: 'Offering', cena: 'Price', tekst: 'Text',
};

function Stavka({ s, naUklanjanje }) {
  const cilj = s.vrsta === 'agencija' || s.agencija_id
    ? '#/agency/' + (s.cilj ?? s.agencija_id)
    : (s.ponuda ? '#/service/' + encodeURIComponent(s.ponuda) : null);

  return (
    <div className={'card sac' + (s.zastarelo ? ' bledo' : '')}>
      <div className="sac-vrh">
        <span className="oznake">
          <span className="tag q">{IME_VRSTE[s.vrsta] || s.vrsta}</span>
          {s.spisak_naziv && <span className="tag">{s.spisak_naziv}</span>}
          {s.zastarelo && <span className="tag zastarelo">no longer in the data</span>}
        </span>
        {s.moja && (
          <button type="button" className="ghost mali x" title="Remove" onClick={() => naUklanjanje(s.id)}>
            ×
          </button>
        )}
      </div>

      <div>
        {cilj ? <a href={cilj}><b>{s.naziv || s.kljuc}</b></a> : <b>{s.naziv || s.kljuc}</b>}
        {s.agencija_ime && s.vrsta !== 'agencija' && (
          <div className="dim tanko">{s.agencija_ime}</div>
        )}
      </div>

      {s.iznos != null && (
        <div className="sac-iznos">
          {$$(s.iznos)}
          {s.iznos_do && s.iznos_do !== s.iznos && <span className="dim">{' – ' + $$(s.iznos_do)}</span>}
          {s.jedinica && <span className="dim tanko">{' / ' + s.jedinica}</span>}
          {s.label && <span className="dim tanko">{' · ' + s.label}</span>}
        </div>
      )}

      {s.citat && <div className="sac-citat tanko">{'“' + String(s.citat).slice(0, 400) + '”'}</div>}

      <div className="sac-vrh dim tanko">
        <span>
          <Prov url={s.source_url} method={s.method} citat={s.citat} />
          {' ' + new Date(s.sacuvana).toISOString().slice(0, 10)}
          {!s.moja && s.ko && <span>{' · ' + s.ko}</span>}
        </span>
      </div>
    </div>
  );
}

export default function Sacuvano() {
  const c = useCuvano();
  const [gde, postaviGde] = useState('sve');     // 'sve' | 'moje' | id spiska
  const [vrsta, postaviVrstu] = useState('');

  const vidljive = useMemo(() => {
    if (!c) return [];
    return c.stavke.filter((s) => {
      if (gde === 'moje' && s.spisak_id !== null) return false;
      if (gde !== 'sve' && gde !== 'moje' && String(s.spisak_id) !== String(gde)) return false;
      if (vrsta && s.vrsta !== vrsta) return false;
      return true;
    });
  }, [c, gde, vrsta]);

  if (!c) return <div className="load">Loading</div>;

  const ukloni = async (id) => c.upisi(await posalji('cuvano/ukloni', { id }));
  const mojih = c.stavke.filter((s) => s.spisak_id === null).length;

  return (
    <>
      <Glava naslov="Saved" desno={<span className="pill">{pl(vidljive.length, 'item')}</span>} />
      <p className="note">
        A saved example keeps the figure, the sentence and the source URL from the moment you saved
        it. When the underlying row is gone after a data refresh, the example stays readable and is
        marked — otherwise &ldquo;saved&rdquo; would mean &ldquo;saved until the data changes&rdquo;.
      </p>

      <div className="filtri">
        <button type="button" className={'ghost mali' + (gde === 'sve' ? ' on' : '')} onClick={() => postaviGde('sve')}>
          All<span className="tag q num">{c.stavke.length}</span>
        </button>
        <button type="button" className={'ghost mali' + (gde === 'moje' ? ' on' : '')} onClick={() => postaviGde('moje')}>
          Just me<span className="tag q num">{mojih}</span>
        </button>
        {c.spiskovi.map((s) => (
          <button
            key={s.id}
            type="button"
            className={'ghost mali' + (String(gde) === String(s.id) ? ' on' : '')}
            onClick={() => postaviGde(s.id)}
          >
            {s.naziv}<span className="tag q num">{s.stavki}</span>
          </button>
        ))}
      </div>

      <div className="filtri">
        <button type="button" className={'ghost mali' + (vrsta === '' ? ' on' : '')} onClick={() => postaviVrstu('')}>
          Everything
        </button>
        {Object.entries(IME_VRSTE).map(([v, ime]) => (
          <button
            key={v}
            type="button"
            className={'ghost mali' + (vrsta === v ? ' on' : '')}
            onClick={() => postaviVrstu(v)}
          >
            {ime}<span className="tag q num">{c.stavke.filter((s) => s.vrsta === v).length}</span>
          </button>
        ))}
      </div>

      {vidljive.length === 0 ? (
        <div className="empty">
          Nothing saved here yet. Use the ☆ next to an agency, offering, price or quote.
        </div>
      ) : (
        <div className="grid g3" style={{ marginTop: '14px' }}>
          {vidljive.map((s) => <Stavka key={s.id} s={s} naUklanjanje={ukloni} />)}
        </div>
      )}
    </>
  );
}
