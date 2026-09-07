import express = require('express');
import { request } from 'node:http';

import { applyProxyTrust } from './proxy-trust';

function readClientIp(trustProxyHops: number, forwardedFor?: string): Promise<string> {
  const app = express();
  applyProxyTrust(app, trustProxyHops);
  app.get('/', (req, response) => response.end(req.ip));
  const server = app.listen(0, '127.0.0.1');

  return new Promise((resolve, reject) => {
    server.once('listening', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('test server did not expose a port'));
        return;
      }
      const clientRequest = request({
        host: '127.0.0.1',
        port: address.port,
        path: '/',
        headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
      }, (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => server.close(() => resolve(body)));
      });
      clientRequest.once('error', (error) => server.close(() => reject(error)));
      clientRequest.end();
    });
    server.once('error', reject);
  });
}

describe('explicit proxy trust contract', () => {
  it('does not trust forwarded headers by default', async () => {
    await expect(readClientIp(0, '198.51.100.7')).resolves.toMatch(/127\.0\.0\.1/);
  });

  it('uses the configured trusted proxy hop to resolve the client IP', async () => {
    await expect(readClientIp(1, '198.51.100.7')).resolves.toBe('198.51.100.7');
  });
});
