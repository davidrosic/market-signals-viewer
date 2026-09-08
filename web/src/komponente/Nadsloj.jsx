// Iskacuci sloj: izbornik "sacuvaj" i oblacic provenijencije.
//
// Crtaju se portalom u <body>, i to U SLOJ PREKO CELOG PROZORA -- `.nadsloj`,
// `position:fixed; inset:0`. Sam sadrzaj je onda `position:absolute` unutar tog
// sloja, pa mu `left/top` znace „od gornjeg levog ugla prozora" po definiciji, a
// ne po tome kakav mu je predak.
//
// Zasto sloj a ne samo `position:fixed` na sadrzaju: `fixed` se ne racuna prema
// prozoru nego prema najblizem pretku koji ima transform, i tu se kvar i desio.
// `.view>*{animation:rise ... both}` je zavrsni okvir `transform:none` drzao kao
// POPUNU, a popunjena vrednost je matrica identiteta, ne kljucna rec -- pa je
// svaka sekcija bila takav predak. Mereno: sloj trazen na (1020, 460) crtao se
// na (1055, 650), a nize na strani je pomeraj izbacivao izbornik ispod ruba
// prozora i to je izgledalo kao da dugme ne radi.
//
// Popuna je popravljena u `stil.css`, portal je sklonio sadrzaj iz sekcije, a
// ovaj sloj je treca brana i jedina koja ne zavisi ni od cega spolja: prozor
// meri SAM SEBE (`clientWidth` samog sloja), pa ne moze da promasi ni ako se
// ispod njega promeni sve.
//
// Sloj NE hvata misa (`pointer-events:none` u CSS-u, `auto` samo na izborniku).
// Kad bi hvatao, tockic nad njim ne bi skrolovao stranu, a ni „klik van zatvara"
// se ne bi dobilo dzabe: sloj koji se ukloni na `pointerdown` pusta `click` do
// dugmeta ispod sebe, koje bi izbornik odmah ponovo otvorilo.
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const IVICA = 8;   // najmanji razmak od ruba prozora
const RAZMAK = 6;  // razmak izmedju sidra i sloja

export default function Nadsloj({ sidro, klasa, slojKlasa, nutar, naZatvaranje, children }) {
  const sloj = useRef(null);
  const moj = useRef(null);
  const [gde, postaviGde] = useState(null);

  // `useLayoutEffect`, ne `useEffect`: radi PRE iscrtavanja, pa se sadrzaj
  // nikad ne vidi na privremenom mestu.
  useLayoutEffect(() => {
    const a = sidro?.current?.getBoundingClientRect();
    const n = moj.current;
    const s = sloj.current;
    if (!a || !n || !s) return;
    // `offsetWidth/Height`, ne `getBoundingClientRect`: sadrzaj ima svoju ulaznu
    // animaciju (`pop`, `scale(.99)`), a `rect` vraca velicinu POSLE transforma
    // -- pa bi mera zavisila od toga u kom je trenutku animacije uhvacena.
    const m = { width: n.offsetWidth, height: n.offsetHeight };
    // Prozor se meri sa samog sloja: on JE prozor, pa se traka za skrolovanje i
    // sve ostalo racuna samo jednom i uvek isto.
    const w = s.clientWidth;
    const h = s.clientHeight;
    // Ispod sidra ako staje; iznad ako ne staje a gore ima mesta. Visina se
    // MERI, ne pogadja -- izbornik raste sa brojem spiskova, a oblacic sa
    // duzinom citata, pa je svaka konstanta ovde pogresna za nekoga.
    const ispod = a.bottom + RAZMAK;
    const iznad = a.top - RAZMAK - m.height;
    const staje = ispod + m.height <= h - IVICA;
    const vrh = staje || iznad < IVICA ? ispod : iznad;
    const levo = Math.max(IVICA, Math.min(a.left, w - m.width - IVICA));
    const gore = Math.max(IVICA, Math.min(vrh, h - m.height - IVICA));
    // Merenje se ponavlja pri svakoj promeni sadrzaja (izbornik raste kad se
    // doda spisak), pa se novi predmet pravi SAMO ako se broj promenio.
    // Bez toga svako merenje pravi novo stanje, novo stanje novo merenje.
    postaviGde((p) => (p && p.left === levo && p.top === gore ? p : { left: levo, top: gore }));
  }, [sidro, children]);

  // Skrol i promena velicine pomeraju sidro a sloj ostaje -- zato se zatvara.
  // `true` jer skrol ne mehuri, a sidro zna da bude u `.wrap` sa svojim skrolom.
  useLayoutEffect(() => {
    if (!naZatvaranje) return undefined;
    window.addEventListener('scroll', naZatvaranje, true);
    window.addEventListener('resize', naZatvaranje);
    return () => {
      window.removeEventListener('scroll', naZatvaranje, true);
      window.removeEventListener('resize', naZatvaranje);
    };
  }, [naZatvaranje]);

  return createPortal(
    <div ref={sloj} className={'nadsloj' + (slojKlasa ? ' ' + slojKlasa : '')}>
      <div
        ref={(n) => { moj.current = n; if (nutar) nutar.current = n; }}
        className={klasa}
        // Dok se ne izmeri, sadrzaj postoji i zauzima prostor (da se izmeri) ali
        // se ne vidi. `visibility`, ne `display:none` -- sakriven blok nema
        // velicinu.
        style={gde
          ? { left: gde.left + 'px', top: gde.top + 'px' }
          : { left: '0px', top: '0px', visibility: 'hidden' }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
