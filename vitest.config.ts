import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Use jsdom for DOM API mocking (needed for Canvas, localStorage, etc.)
    environment: 'jsdom',
    
    // Global test setup
    globals: true,
    
    // Include test files
    include: ['src/**/*.test.ts'],
    
    // Setup files run before each test file
    setupFiles: ['./src/test/setup.ts'],
  },
  
  // Path aliases matching tsconfig.json
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@content': resolve(__dirname, './content'),
    },
  },
});
