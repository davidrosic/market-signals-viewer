// Sloj ka /api. Kapija je NA SERVERU -- svaki /api/* bez sesije vraca 401.
// Ovde je samo prikaz; sakriveno dugme nikad nije zastita.

// 401 se ne vraca pozivaocu nego se baca, jer svaki prikaz odmah cita d.nesto
// i na undefined bi pukao usred crtanja. Bacanje prekida prikaz na mestu, a
// sloj iznad hvata bas ovaj simbol i cuti.
export const NEPRIJAVLJEN = Symbol('neprijavljen');

// Ko je izgubio sesiju usred rada -- App se pretplati i prikaze prijavu.
let naOdjavu = () => {};
export function pratiOdjavu(f) { naOdjavu = f; }

export const state = { grad: '' };

export async function api(put, opcije = {}) {
  const { tiho, ...ostalo } = opcije;
  const sp = new URLSearchParams();
  if (state.grad) sp.set('grad', state.grad);
  const q = sp.toString();
  const r = await fetch('/api/' + put + (q ? (put.includes('?') ? '&' : '?') + q : ''),
    { credentials: 'same-origin', ...ostalo });
  if (r.status === 401 && !tiho) {
    naOdjavu();
    throw NEPRIJAVLJEN;
  }
  return r.json();
}

// `tiho` je obavezno na prijavi: bez njega bi pogresna lozinka (401) pozvala
// prikaz prijave iz same prijave.
export const posalji = (put, telo, tiho) => api(put, {
  tiho,
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(telo || {}),
});

// Poslednja brana: NEPRIJAVLJEN je NAMERNA kontrola toka, ne greska. Ako
// iskoci iz putanje koju niko ne ceka, pregledac bi ga prijavio kao neuhvacen
// i to crvenilo bi sakrilo prave greske.
export const nezavisno = (o) => o.catch((e) => { if (e !== NEPRIJAVLJEN) throw e; });
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (e) => {
    if (e.reason === NEPRIJAVLJEN) e.preventDefault();
  });
}

// --- oblikovanje -----------------------------------------------------------
export const N = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('en-US'));
export const $$ = (n) => (n === null || n === undefined ? '—'
  : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }));

// Kategorija je ENUM od 25 poznatih kljuceva, pa je doslovan spisak tacniji od
// obrasca: veliko-prvo-slovo je od 'seo' pravilo 'Seo', od 'ppc' 'Ppc'.
// Spisak gresi samo na onome sto u njemu pise -- CLAUDE.md, ogranicenje 6.
const IME_KAT = {
  ai: 'AI', analytics: 'Analytics', app_dev: 'App Development',
  branding: 'Branding', cms: 'CMS', content: 'Content',
  ecommerce: 'E-commerce', email: 'Email', events: 'Events',
  graphic_design: 'Graphic Design', hosting: 'Hosting',
  maintenance: 'Maintenance', marketing: 'Marketing', other: 'Other',
  photo: 'Photography', ppc: 'PPC', pr: 'PR', seo: 'SEO', social: 'Social',
  software: 'Software', staffing: 'Staffing', strategy: 'Strategy',
  video: 'Video', web_design: 'Web Design', web_dev: 'Web Development',
};
export const cap = (s) => IME_KAT[s]
  || String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Ime ponude dolazi iz baze -- naziv koji najvise agencija stvarno pise. `cap`
// je ostao samo za KLJUCEVE kategorija; nad kljucem ponude je pisao 'Seo'.
export const imeP = (r, k) => r.naziv || cap(r[k || 'ponuda']);

// '1 agencies' i '1 prices' su pisali svuda gde broj ume da bude jedan.
export const pl = (n, jedan, vise) => `${N(n)} ${n === 1 ? jedan : (vise || jedan + 's')}`;
