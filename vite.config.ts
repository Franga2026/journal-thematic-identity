import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createSdgApiMiddleware } from './src/server/sdgApiMiddleware';
import { createCollaboratorsApiMiddleware } from './src/server/collaboratorsApiMiddleware';
import { createAiApiMiddleware } from './src/server/aiApiMiddleware';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'uta-api-middleware',
      configureServer(server) {
        server.middlewares.use(createSdgApiMiddleware());
        server.middlewares.use(createCollaboratorsApiMiddleware());
        server.middlewares.use(createAiApiMiddleware());
      },
      configurePreviewServer(server) {
        server.middlewares.use(createSdgApiMiddleware());
        server.middlewares.use(createCollaboratorsApiMiddleware());
        server.middlewares.use(createAiApiMiddleware());
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@components': path.resolve(__dirname, './src/components'),
      '@context': path.resolve(__dirname, './src/context'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
});
