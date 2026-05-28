import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig, loadEnv } from 'vite';
import inlineEditPlugin from './plugins/visual-editor/vite-plugin-react-inline-editor.js';
import editModeDevPlugin from './plugins/visual-editor/vite-plugin-edit-mode.js';
import iframeRouteRestorationPlugin from './plugins/vite-plugin-iframe-route-restoration.js';
import selectionModePlugin from './plugins/selection-mode/vite-plugin-selection-mode.js';

const fallbackBackendPort = '3001';

const normalizeUrl = (value = '') => String(value || '').trim().replace(/\/+$/, '');

const parseBackendPort = (value = '') => {
  const match = String(value || '').match(/^\s*PORT\s*=\s*(\d+)\s*$/m);
  return match?.[1] || '';
};

const readBackendPortFromEnvFile = () => {
  try {
    const envFiles = [
      path.resolve(__dirname, '../backend/.env.local'),
      path.resolve(__dirname, '../backend/.env'),
    ];

    for (const filePath of envFiles) {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf8');
      const port = parseBackendPort(content);
      if (port) return port;
    }
  } catch {
    // Fall back to the default Vite proxy port.
  }

  return '';
};

const resolveBackendUrl = (env) => {
  const explicitUrl = normalizeUrl(env.VITE_BACKEND_URL);
  if (explicitUrl) return explicitUrl;

  const backendPort = readBackendPortFromEnvFile() || fallbackBackendPort;
  return `http://localhost:${backendPort}`;
};

// Reuse the same content from the original config but set root to this folder
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const isDev = (env.NODE_ENV || mode) !== 'production';
  const backendUrl = resolveBackendUrl(env);

  return {
    root: path.resolve(__dirname, '.'),
    customLogger: createLogger(),
    plugins: [
      ...(isDev ? [inlineEditPlugin(), editModeDevPlugin(), iframeRouteRestorationPlugin(), selectionModePlugin()] : []),
      react(),
    ],
    server: {
      cors: true,
      headers: env.VITE_ENABLE_COEP === 'true' ? { 'Cross-Origin-Embedder-Policy': 'credentialless' } : {},
      allowedHosts: true,
      proxy: {
        '/api': { target: backendUrl, changeOrigin: true, rewrite: (p) => p },
        '/uploads': { target: backendUrl, changeOrigin: true, rewrite: (p) => p },
      },
    },
    resolve: {
      extensions: ['.jsx', '.js', '.tsx', '.ts', '.json'],
      alias: { '@': path.resolve(__dirname, './src') },
    },
  };
});
