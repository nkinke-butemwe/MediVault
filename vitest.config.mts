// vitest.config.ts
//
// Configuration for the test runner (Vitest).
//
// Why Vitest: it works well with TypeScript and React out of the box,
// runs fast, and doesn't need extra config files the way some other
// test runners do. Running `npm test` (see package.json) invokes this.
//
// What "resolve.alias" does below: our source code imports things like
//   import { signToken } from '@/src/lib/auth'
// The "@/" part is a shortcut defined in tsconfig.json that normally only
// TypeScript and Next.js understand. Vitest doesn't read tsconfig.json's
// path mappings automatically, so we repeat the same mapping here in a
// format Vitest understands, pointing "@" at the project's root folder.

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname),
    },
  },
  test: {
    // "node" is enough for our tests: we test plain functions (auth,
    // validators, rate limiting) and render icon components to a string
    // using react-dom/server, which does not need a simulated browser (jsdom).
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Give async tests (like JWT signing) a generous timeout
    testTimeout: 10000,
  },
})
