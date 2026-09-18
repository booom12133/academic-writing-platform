import { createServer, type Server } from 'node:http';

import { verifyFrontendOverHttp } from '../../scripts/test-production-artifact';

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('test server did not expose a TCP port'));
        return;
      }
      resolve(address.port);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe('production artifact frontend HTTP smoke', () => {
  it('rejects SPA fallback HTML returned for referenced JS and CSS assets', async () => {
    const index = [
      '<!doctype html>',
      '<link rel="stylesheet" href="/assets/app.css">',
      '<script type="module" src="/assets/app.js"></script>',
    ].join('\n');
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(index);
    });
    const port = await listen(server);
    try {
      await expect(verifyFrontendOverHttp(port)).rejects.toThrow(
        /frontend asset \/assets\/app\.(?:css|js) returned text\/html/,
      );
    } finally {
      await close(server);
    }
  });

  it('accepts real JavaScript and CSS responses with appropriate MIME types', async () => {
    const index = [
      '<!doctype html>',
      '<link rel="stylesheet" href="/assets/app.css">',
      '<script type="module" src="/assets/app.js"></script>',
    ].join('\n');
    const server = createServer((request, response) => {
      if (request.url === '/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(index);
        return;
      }
      if (request.url === '/assets/app.js') {
        response.writeHead(200, { 'content-type': 'application/javascript' });
        response.end('export {};');
        return;
      }
      if (request.url === '/assets/app.css') {
        response.writeHead(200, { 'content-type': 'text/css' });
        response.end('body {}');
        return;
      }
      response.writeHead(404);
      response.end();
    });
    const port = await listen(server);
    try {
      await expect(verifyFrontendOverHttp(port)).resolves.toEqual([
        '/assets/app.css',
        '/assets/app.js',
      ]);
    } finally {
      await close(server);
    }
  });
});
