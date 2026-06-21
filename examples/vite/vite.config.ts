import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Alias the core package to its source so the demo runs with no build step
// (great DX). Consumers of the published package import the built dist instead.
const coreSrc = fileURLToPath(new URL('../../packages/core/src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@openhistorymap/timeline-core/wikidata': `${coreSrc}/wikidata.ts`,
      '@openhistorymap/timeline-core': `${coreSrc}/index.ts`,
    },
  },
});
