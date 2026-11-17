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
  fixedExtension: false, // emit dist/index.js (the package is "type": "module"), as `npm start` expects
  clean: true,
  noExternal: ['@app/shared'],
})
