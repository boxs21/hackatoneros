import { defineConfig } from 'vite';

// base relativa para que funcione en https://<usuario>.github.io/<repo>/
export default defineConfig({
  base: './',
  server: { host: true },
});
