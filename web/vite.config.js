import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    // CSP je stroga i ostaje stroga. Vite podrazumevano UGRADI mali CSS kao
    // inline <style>, a to bi trazilo 'unsafe-inline' u style-src i pojelo
    // celu politiku. Prag 0 znaci: sve u fajl, nista inline.
    assetsInlineLimit: 0,
    cssCodeSplit: true,
    sourcemap: false,
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // U razvoju React radi na 5173 a API na 8770; u produkciji ih nginx spaja
    // pod istim poreklom, pa kolacic radi u oba slucaja.
    proxy: { '/api': { target: 'http://127.0.0.1:8770', changeOrigin: false } },
  },
});
