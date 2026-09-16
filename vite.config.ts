import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const BANNON_MODELS_RAW =
  'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/models';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // public/models is served first. Missing skins proxy from mhvnsnt/Bannon.
      proxy: {
        '/models': {
          target: BANNON_MODELS_RAW,
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/models/, ''),
        },
      },
    },
  };
});
