import { defineConfig } from 'vite';
import { rundotGameLibrariesPlugin, rundotGamePlaygroundPlugin } from '@series-inc/rundot-game-sdk/vite';

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [rundotGameLibrariesPlugin(), ...(mode === 'playground' ? [rundotGamePlaygroundPlugin()] : [])],
  define: { __RUN_PLAYGROUND__: JSON.stringify(mode === 'playground') },
  oxc: { target: 'es2022' },
  build: { target: 'es2022', outDir: 'dist-run' },
  server: { port: 5173, strictPort: true },
}));
