// Iskacuci sloj: izbornik "sacuvaj" i oblacic provenijencije.
//
// Crta se PORTALOM u <body>, ne kraj sidra, i tek posle merenja sopstvene
// velicine.
//
// `position:fixed` se ne racuna prema prozoru nego prema najblizem pretku koji
// ima transform. `.view>*{animation:rise ... both}` je drzao zavrsni okvir
// `transform:none` kao POPUNU, a popunjena vrednost je matrica identiteta, ne
// kljucna rec `none` -- pa je svaka sekcija bila takav predak. Mereno na
// stranici ponude: sloj trazen na (1020, 460) crtao se na (1055, 650), pomeren
// tacno za pocetak sekcije; kod dugmeta nize na strani pomeraj izbaci izbornik
// ispod donjeg ruba prozora i izgleda kao da dugme ne radi.
//
// Popuna je popravljena u `stil.css`, ali portal je ono zbog cega se kvar ne
// moze vratiti: sledeci `transform` na bilo kom pretku (`a.card:hover` ga vec
// ima) ne moze da pomeri sloj koji nije njegov potomak.
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const IVICA = 8;   // najmanji razmak od ruba prozora
const RAZMAK = 6;  // razmak izmedju sidra i sloja

export default function Nadsloj({ sidro, klasa, nutar, naZatvaranje, children }) {
  const moj = useRef(null);
  const [gde, postaviGde] = useState(null);

  // `useLayoutEffect`, ne `useEffect`: radi PRE iscrtavanja, pa se sloj nikad
  // ne vidi na privremenom mestu.
  useLayoutEffect(() => {
    const a = sidro?.current?.getBoundingClientRect();
    const n = moj.current;
    if (!a || !n) return;
    // `offsetWidth/Height`, ne `getBoundingClientRect`: sloj ima svoju ulaznu
    // animaciju (`pop`, `scale(.99)`), a `rect` vraca velicinu POSLE transforma
    // -- pa bi mera zavisila od toga u kom je trenutku animacije uhvacena.
    const m = { width: n.offsetWidth, height: n.offsetHeight };
    const w = document.documentElement.clientWidth;
    const h = document.documentElement.clientHeight;
    // Ispod sidra ako staje; iznad ako ne staje a gore ima mesta. Visina se
    // MERI, ne pogadja -- izbornik raste sa brojem spiskova, a oblacic sa
    // duzinom citata, pa je svaka konstanta ovde pogresna za nekoga.
    const ispod = a.bottom + RAZMAK;
    const iznad = a.top - RAZMAK - m.height;
    const staje = ispod + m.height <= h - IVICA;
    const top = staje || iznad < IVICA ? ispod : iznad;
    const levo = Math.max(IVICA, Math.min(a.left, w - m.width - IVICA));
    const gore = Math.max(IVICA, Math.min(top, h - m.height - IVICA));
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
    <div
      ref={(n) => { moj.current = n; if (nutar) nutar.current = n; }}
      className={klasa}
      // Dok se ne izmeri, sloj postoji i zauzima prostor (da se izmeri) ali se
      // ne vidi. `visibility`, ne `display:none` -- sakriven blok nema velicinu.
      style={gde
        ? { left: gde.left + 'px', top: gde.top + 'px' }
        : { left: '0px', top: '0px', visibility: 'hidden' }}
    >
      {children}
    </div>,
    document.body,
  );
}
