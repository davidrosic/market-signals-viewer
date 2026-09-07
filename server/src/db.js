// Veza ka Postgresu. Sajt je CITAC: rola `sajt` nad semom `public` ima samo
// SELECT (deploy/grants.sql), pa greska u upitu ne moze da promeni podatke.
import pg from 'pg';

// `numeric` (OID 1700) node-postgres podrazumevano vraca kao STRING, da ne
// izgubi preciznost. Nama su to iznosi koje frontend crta, pa ih hocemo kao
// broj -- isto sto je Python radio sa `::float` u upitima.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
// `int8` (OID 20) isto stize kao string; svi nasi count-ovi staju u Number.
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

export function napraviBazen() {
  const bazen = new pg.Pool({
    connectionString: process.env.AIC_DSN,
    max: Number(process.env.AIC_VEZA || 4),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  // Postgres se restartuje (nadogradnja, `objavi.sh`, pad) i veza u bazenu to
  // sazna tek kad je neko upotrebi. node-postgres sam izbaci vezu koja pukne
  // dok je besposlena -- ali samo ako neko slusa ovaj dogadjaj; bez slusaoca
  // je to neuhvacen izuzetak koji obori proces.
  bazen.on('error', (e) => {
    console.error('[bazen] veza otpala:', e.message);
  });

  return bazen;
}

// Python verzija je morala da gasi pripremu upita (`prepare_threshold = None`):
// psycopg posle petog izvrsavanja pravi PREPARE, Postgres predje na genericki
// plan, i `/api/ponuda/seo` je sa 206 ms skakalo na 1.377 ms. node-postgres
// ne priprema upite sam od sebe (samo kad se prosledi `name`), pa se to ovde
// ne moze desiti -- i zato se `name` NE koristi ni u jednom upitu.
export async function upit(bazen, sql, args = []) {
  const r = await bazen.query(sql, args);
  return r.rows;
}

// Skupljac parametara. Python je koristio `%s` i redjao argumente rucno, sto je
// kod dinamickih uslova (filter grada) lako ispadalo iz koraka. Ovde svaki
// parametar sam kaze koji je po redu.
export function parametri() {
  const args = [];
  const p = (v) => {
    args.push(v);
    return '$' + args.length;
  };
  p.args = args;
  return p;
}
