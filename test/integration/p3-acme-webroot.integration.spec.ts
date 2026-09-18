import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { connect, createServer } from 'node:net';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';

const enabled = process.platform === 'linux' && process.env.P3_NGINX_UPLOAD_INTEGRATION === 'YES';
const describeIfEnabled = enabled ? describe : describe.skip;

async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('port reservation failed'));
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForPort(port: number, child: ChildProcessWithoutNullStreams): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error('temporary Nginx exited');
    const ready = await new Promise<boolean>((resolve) => {
      const socket = connect({ host: '127.0.0.1', port });
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
    });
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('temporary Nginx did not start');
}

function get(port: number, path: string): Promise<{ status: number; body: string; location?: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, headers: { host: 'write.yingrenji.cn' } }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => resolve({ status: response.statusCode || 0, body: Buffer.concat(chunks).toString(), location: response.headers.location }));
    });
    req.once('error', reject);
    req.end();
  });
}

describeIfEnabled('P3 ACME webroot exception', () => {
  let root: string;
  let child: ChildProcessWithoutNullStreams;
  let port: number;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'p3-acme-nginx-'));
    port = await reservePort();
    const challenge = join(root, 'webroot', '.well-known', 'acme-challenge');
    await mkdir(challenge, { recursive: true });
    await writeFile(join(challenge, 'known-token'), 'known-token-value');
    await mkdir(join(root, 'logs'));
    const config = `worker_processes 1; pid logs/nginx.pid; error_log logs/error.log notice;
events { worker_connections 32; }
http { access_log off; server { listen 127.0.0.1:${port}; server_name write.yingrenji.cn;
location ^~ /.well-known/acme-challenge/ { root ${join(root, 'webroot').replaceAll('\\', '/')}; default_type text/plain; try_files $uri =404; }
location / { return 301 https://$host$request_uri; }
} }`;
    const configPath = join(root, 'nginx.conf');
    await writeFile(configPath, config);
    const check = spawnSync('nginx', ['-t', '-p', `${root}/`, '-c', configPath], { encoding: 'utf8' });
    if (check.status !== 0) throw new Error(check.stderr);
    child = spawn('nginx', ['-p', `${root}/`, '-c', configPath, '-g', 'daemon off;'], { stdio: 'pipe' });
    await waitForPort(port, child);
  });

  afterAll(async () => {
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise<void>((resolve) => child.once('exit', () => resolve()));
    }
    await rm(root, { recursive: true, force: true });
  });

  it('serves only known challenge tokens while preserving ordinary HTTPS redirects', async () => {
    await expect(get(port, '/.well-known/acme-challenge/known-token')).resolves.toMatchObject({ status: 200, body: 'known-token-value' });
    await expect(get(port, '/.well-known/acme-challenge/missing')).resolves.toMatchObject({ status: 404 });
    await expect(get(port, '/')).resolves.toMatchObject({ status: 301, location: 'https://write.yingrenji.cn/' });
    await expect(get(port, '/api/health?x=1')).resolves.toMatchObject({ status: 301, location: 'https://write.yingrenji.cn/api/health?x=1' });
  });
});
