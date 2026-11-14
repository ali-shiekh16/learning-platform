import { defineConfig } from 'tsdown'

/**
 * Production build: bundles the server and the @app/shared workspace package
 * (which ships TypeScript source) into dist/. npm dependencies stay external.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  noExternal: ['@app/shared'],
})
