// Zaglavlja i kolacic. Stoje na JEDNOM mestu, pa nema para vrednosti koje se
// razidju; `deploy/nginx-aic.conf` ih ponavlja samo za fajlove koje sam sluzi.
export const KOLACIC = 'aic_sesija';
export const DANA_SESIJE = 30;

// CSP je stroga jer sme da bude: React se gradi u obicne .js fajlove, bez
// inline skripti. Vite u PRODUKCIJI ne ubacuje inline `<script>`, ali ubacuje
// inline `<style>` za CSS koji je manji od praga -- zato `cssCodeSplit` i prag
// 0 u vite.config.js, da sve ode u fajl i da `style-src` ostane bez
// 'unsafe-inline'. Ako ovo ikad olabavis, olabavio si celu politiku.
export const CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

export function zaglavlja(req, res, next) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}

// Iza nginx-a je veza ka Node-u obican HTTP, pa `req.secure` ne vredi nista.
// `X-Forwarded-Proto` postavlja nginx i klijentova vrednost ne moze da prodje
// -- vidi `proxy_set_header` u deploy/nginx-aic.conf.
export function preko_https(req) {
  return (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

export function postaviKolacic(req, res, token) {
  res.cookie(KOLACIC, token, {
    httpOnly: true,
    secure: preko_https(req),
    sameSite: 'lax',
    path: '/',
    maxAge: DANA_SESIJE * 24 * 3600 * 1000,
  });
}

export function obrisiKolacic(req, res) {
  res.clearCookie(KOLACIC, {
    httpOnly: true,
    secure: preko_https(req),
    sameSite: 'lax',
    path: '/',
  });
}

// SameSite=Lax vec blokira unakrsni POST sa kolacicem; ovo je druga brana i
// kosta tri reda. Zahtev bez `Origin` prolazi -- to je curl i alat, ne
// pregledac koji nekog vodi na tudju stranu.
export function istoPoreklo(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try {
    return new URL(o).host === req.headers.host;
  } catch {
    return false;
  }
}
