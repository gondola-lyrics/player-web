import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const root = import.meta.dirname
const src = resolve(root, 'src')
const out = resolve(root, 'dist')

export default defineConfig({
  resolve: {
    alias: {
      '@root': src,
    },
  },
  plugins: [
    dts({
      tsconfigPath: resolve(root, 'tsconfig.json'),
      include: ['src'],
      bundleTypes: true,
      outDirs: [{ dir: out }],
    }),
  ],
  build: {
    target: 'esnext',
    outDir: out,
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    reportCompressedSize: false,
    lib: {
      entry: {
        index: resolve(src, 'index.ts'),
        core: resolve(src, 'core/index.ts'),
        dom: resolve(src, 'dom/index.ts'),
      },
      formats: ['es'],
    },
    rolldownOptions: {
      external: [/^@gondola-lyrics\/model(?:\/|$)/, /^@bufbuild\/protobuf(?:\/|$)/],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
      },
    },
  },
})
