import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/postcss';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const project=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig({
  root:project,
  base:'./',
  publicDir:false,
  plugins:[react()],
  resolve:{alias:{'@':project}},
  css:{postcss:{plugins:[tailwind()]}},
  build:{outDir:resolve(project,'dist'),emptyOutDir:true},
});
