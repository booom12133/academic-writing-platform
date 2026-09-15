import 'reflect-metadata';

import {
  Body,
  Controller,
  Inject,
  Post,
  Req,
  UploadedFile,
  UseFilters,
  UseInterceptors,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FileInterceptor } from '@nestjs/platform-express';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { connect, createServer } from 'node:net';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { request, type IncomingHttpHeaders } from 'node:http';
import { json, type NextFunction, type Request, type Response } from 'express';
import FormData = require('form-data');

import { DocumentInputError } from '../../server/modules/document-input/document-input.errors';
import { DocumentInputExceptionFilter } from '../../server/modules/document-input/document-input.exception-filter';
import {
  DocumentInputService,
  MAX_DOCUMENT_INPUT_SIZE_BYTES,
} from '../../server/modules/document-input/document-input.service';
import { SelfHostedFilesystemDocumentStorageAdapter } from '../../server/modules/document-input/filesystem-document-storage.adapter';
import type { UploadedDocument } from '../../server/modules/document-input/document-input.storage';

const root = resolve(__dirname, '..', '..');
const MIB = 1024 * 1024;
const APP_FILE_LIMIT_BYTES = 20 * MIB;
const NGINX_BODY_LIMIT_BYTES = 22 * MIB;
const integrationEnabled =
  process.platform === 'linux' && process.env.P3_NGINX_UPLOAD_INTEGRATION === 'YES';

interface HttpResult {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
  requestBodyBytes: number;
}

interface TemporaryNginx {
  port: number;
  prefix: string;
  configPath: string;
  validation: string;
  child: ChildProcessWithoutNullStreams;
}

class A6JsonController {
  acceptJson(body: unknown): { accepted: true; body: unknown } {
    return { accepted: true, body };
  }
}

class A6DocumentInputBoundaryController {
  constructor(private readonly documentInputService: DocumentInputService) {}

  async upload(
    incoming: Request,
    file?: UploadedDocument,
  ): Promise<unknown> {
    const userId = incoming.userContext?.userId;
    if (!userId || !file) {
      throw new DocumentInputError('INVALID_DOCUMENT_UPLOAD', 'A document file is required.');
    }
    return this.documentInputService.upload(userId, file);
  }
}

Controller('a6')(A6JsonController);
Post('json')(
  A6JsonController.prototype,
  'acceptJson',
  Object.getOwnPropertyDescriptor(A6JsonController.prototype, 'acceptJson')!,
);
Body()(A6JsonController.prototype, 'acceptJson', 0);

Controller('api/document-inputs')(A6DocumentInputBoundaryController);
UseFilters(DocumentInputExceptionFilter)(A6DocumentInputBoundaryController);
Post()(
  A6DocumentInputBoundaryController.prototype,
  'upload',
  Object.getOwnPropertyDescriptor(A6DocumentInputBoundaryController.prototype, 'upload')!,
);
UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: MAX_DOCUMENT_INPUT_SIZE_BYTES, files: 1 },
}))(
  A6DocumentInputBoundaryController.prototype,
  'upload',
  Object.getOwnPropertyDescriptor(A6DocumentInputBoundaryController.prototype, 'upload')!,
);
Req()(A6DocumentInputBoundaryController.prototype, 'upload', 0);
UploadedFile()(A6DocumentInputBoundaryController.prototype, 'upload', 1);
Inject(DocumentInputService)(A6DocumentInputBoundaryController, undefined, 0);

const reservePort = async (): Promise<number> => new Promise((resolvePort, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      reject(new Error('Could not reserve a loopback port.'));
      return;
    }
    server.close((error) => error ? reject(error) : resolvePort(address.port));
  });
});

const waitForPort = async (
  port: number,
  child: ChildProcessWithoutNullStreams,
  stderr: () => string,
): Promise<void> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Temporary Nginx exited before listening: ${stderr()}`);
    }
    const connected = await new Promise<boolean>((resolveConnection) => {
      const socket = connect({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.destroy();
        resolveConnection(true);
      });
      socket.once('error', () => resolveConnection(false));
    });
    if (connected) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  throw new Error(`Temporary Nginx did not listen on ${port}: ${stderr()}`);
};

const extractBodyLimit = (template: string): string => {
  const match = template.match(/client_max_body_size\s+([^;]+);/u);
  if (!match) throw new Error('Repository Nginx template has no client_max_body_size directive.');
  return match[1].trim();
};

const renderTemporaryConfig = (port: number, upstreamPort: number, limit: string): string => `
worker_processes 1;
pid logs/nginx.pid;
error_log logs/error.log notice;

events { worker_connections 64; }

http {
    access_log logs/access.log;
    client_body_temp_path client_body_temp;

    server {
        listen 127.0.0.1:${port};
        server_name localhost;
        client_max_body_size ${limit};

        location / {
            proxy_pass http://127.0.0.1:${upstreamPort};
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Connection "";
            proxy_read_timeout 60s;
            proxy_send_timeout 60s;
        }
    }
}
`;

const startTemporaryNginx = async (
  workRoot: string,
  name: string,
  upstreamPort: number,
  limit: string,
): Promise<TemporaryNginx> => {
  const prefix = join(workRoot, name);
  const configPath = join(prefix, 'nginx.conf');
  const port = await reservePort();
  await mkdir(join(prefix, 'logs'), { recursive: true });
  await mkdir(join(prefix, 'client_body_temp'), { recursive: true });
  await writeFile(configPath, renderTemporaryConfig(port, upstreamPort, limit), 'utf8');

  const args = ['-p', `${prefix}/`, '-c', configPath];
  const check = spawnSync('nginx', [...args, '-t'], { encoding: 'utf8' });
  const validation = `${check.stdout ?? ''}${check.stderr ?? ''}`.trim();
  if (check.status !== 0) {
    throw new Error(`nginx -t failed for ${name}: ${validation}`);
  }

  const child = spawn('nginx', [...args, '-g', 'daemon off;'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });
  await waitForPort(port, child, () => stderr);
  return { port, prefix, configPath, validation, child };
};

const stopTemporaryNginx = async (nginx: TemporaryNginx | undefined): Promise<void> => {
  if (!nginx || nginx.child.exitCode !== null) return;
  const quit = spawnSync(
    'nginx',
    ['-p', `${nginx.prefix}/`, '-c', nginx.configPath, '-s', 'quit'],
    { encoding: 'utf8' },
  );
  if (quit.status !== 0) nginx.child.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolveExit) => nginx.child.once('exit', () => resolveExit())),
    new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 5_000)),
  ]);
  if (nginx.child.exitCode === null) nginx.child.kill('SIGKILL');
};

const collectResponse = (
  options: Parameters<typeof request>[0],
  requestBodyBytes: number,
  writeRequest: (outgoing: ReturnType<typeof request>) => void,
): Promise<HttpResult> => new Promise((resolveResponse, reject) => {
  const outgoing = request(options, (incoming) => {
    const chunks: Buffer[] = [];
    incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
    incoming.once('end', () => resolveResponse({
      status: incoming.statusCode ?? 0,
      headers: incoming.headers,
      body: Buffer.concat(chunks).toString('utf8'),
      requestBodyBytes,
    }));
  });
  outgoing.once('error', reject);
  writeRequest(outgoing);
});

const sendMultipart = (port: number, fileBytes: number): Promise<HttpResult> => {
  const form = new FormData();
  form.append('file', Buffer.alloc(fileBytes, 0x61), {
    filename: 'a6-boundary.txt',
    contentType: 'text/plain',
    knownLength: fileBytes,
  });
  const requestBodyBytes = form.getLengthSync();
  const outgoingHeaders = {
    ...form.getHeaders(),
    'content-length': requestBodyBytes,
    'x-test-user': 'a6-user',
  };
  return collectResponse({
    host: '127.0.0.1',
    port,
    path: '/api/document-inputs',
    method: 'POST',
    headers: outgoingHeaders,
  }, requestBodyBytes, (outgoing) => form.pipe(outgoing));
};

const sendBuffer = (
  port: number,
  path: string,
  contentType: string,
  body: Buffer,
): Promise<HttpResult> => collectResponse({
  host: '127.0.0.1',
  port,
  path,
  method: 'POST',
  headers: {
    'content-type': contentType,
    'content-length': body.length,
    'x-test-user': 'a6-user',
  },
}, body.length, (outgoing) => outgoing.end(body));

const evidence = (scenario: string, result: HttpResult, upstreamDelta: number): void => {
  console.info('A6_BOUNDARY_EVIDENCE', JSON.stringify({
    scenario,
    requestBodyBytes: result.requestBodyBytes,
    status: result.status,
    upstreamDelta,
    upstreamHeader: result.headers['x-a6-upstream'] ?? null,
  }));
};

const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('P3 WP-A6 disposable Nginx upload boundary', () => {
  jest.setTimeout(120_000);

  let app: INestApplication;
  let workRoot: string;
  let storageRoot: string;
  let upstreamPort: number;
  let currentNginx: TemporaryNginx | undefined;
  let upstreamHits = 0;

  beforeAll(async () => {
    workRoot = await mkdtemp(join(tmpdir(), 'p3-a6-nginx-'));
    storageRoot = join(workRoot, 'storage');
    await mkdir(storageRoot, { recursive: true });

    const storage = new SelfHostedFilesystemDocumentStorageAdapter(storageRoot);
    const parser = {
      parse: jest.fn(async (input: { buffer: Buffer; fileName: string; mimeType?: string }) => ({
        source: {
          type: 'txt' as const,
          fileName: input.fileName,
          extension: '.txt' as const,
          mimeType: input.mimeType,
          sizeBytes: input.buffer.length,
        },
        title: 'A6 boundary document',
        blocks: [{ id: 'b000001', type: 'paragraph' as const, text: 'A6 boundary.' }],
        outline: [],
        plainText: 'A6 boundary.',
        metadata: {},
        warnings: [],
      })),
    };
    const service = new DocumentInputService(
      storage,
      parser as never,
      { build: jest.fn() } as never,
      { chunk: jest.fn() } as never,
    );
    const moduleRef = await Test.createTestingModule({
      controllers: [A6DocumentInputBoundaryController, A6JsonController],
      providers: [{ provide: DocumentInputService, useValue: service }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use((incoming: Request, response: Response, next: NextFunction) => {
      upstreamHits += 1;
      response.setHeader('X-A6-Upstream', 'yes');
      Object.assign(incoming, { userContext: { userId: incoming.header('x-test-user') } });
      next();
    });
    app.use(json({ limit: '1mb' }));
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') throw new Error('Test app did not bind TCP.');
    upstreamPort = address.port;

    const template = await readFile(
      join(root, 'deploy', 'nginx', 'academic-writing-platform.conf'),
      'utf8',
    );
    currentNginx = await startTemporaryNginx(
      workRoot,
      'current',
      upstreamPort,
      extractBodyLimit(template),
    );
    console.info('A6_NGINX_T_EVIDENCE', currentNginx.validation);
  });

  afterAll(async () => {
    await stopTemporaryNginx(currentNginx);
    if (app) await app.close();
    if (workRoot) await rm(workRoot, { recursive: true, force: true });
  });

  it('proves the legacy 1m limit blocks a multipart upload the application allows', async () => {
    const legacyNginx = await startTemporaryNginx(workRoot, 'legacy-1m', upstreamPort, '1m');
    try {
      const before = upstreamHits;
      const result = await sendMultipart(legacyNginx.port, 2 * MIB);
      const upstreamDelta = upstreamHits - before;
      evidence('legacy-1m-valid-multipart-red', result, upstreamDelta);

      expect(result.requestBodyBytes).toBeGreaterThan(MIB);
      expect(result.requestBodyBytes).toBeLessThan(NGINX_BODY_LIMIT_BYTES);
      expect(result.status).toBe(413);
      expect(result.headers['x-a6-upstream']).toBeUndefined();
      expect(upstreamDelta).toBe(0);
    } finally {
      await stopTemporaryNginx(legacyNginx);
    }
  });

  it('passes a >1 MiB and <=20 MiB multipart request for application acceptance', async () => {
    const before = upstreamHits;
    const result = await sendMultipart(currentNginx!.port, 2 * MIB);
    const upstreamDelta = upstreamHits - before;
    evidence('valid-multipart-through-nginx', result, upstreamDelta);

    expect(result.requestBodyBytes).toBeGreaterThan(MIB);
    expect(result.requestBodyBytes).toBeLessThan(NGINX_BODY_LIMIT_BYTES);
    expect(result.status).toBe(201);
    expect(result.headers['x-a6-upstream']).toBe('yes');
    expect(upstreamDelta).toBe(1);
    expect(JSON.parse(result.body)).toMatchObject({
      document: { fileName: 'a6-boundary.txt', sizeBytes: 2 * MIB },
    });
  });

  it('passes a >20 MiB multipart request below 22 MiB to the application for 413', async () => {
    const before = upstreamHits;
    const result = await sendMultipart(currentNginx!.port, APP_FILE_LIMIT_BYTES + 1);
    const upstreamDelta = upstreamHits - before;
    evidence('application-multipart-413', result, upstreamDelta);

    expect(result.requestBodyBytes).toBeGreaterThan(APP_FILE_LIMIT_BYTES);
    expect(result.requestBodyBytes).toBeLessThan(NGINX_BODY_LIMIT_BYTES);
    expect(result.status).toBe(413);
    expect(result.headers['x-a6-upstream']).toBe('yes');
    expect(upstreamDelta).toBe(1);
  });

  it('rejects a whole request over 22 MiB at Nginx with zero upstream hits', async () => {
    const before = upstreamHits;
    const result = await sendBuffer(
      currentNginx!.port,
      '/a6/json',
      'application/octet-stream',
      Buffer.alloc(NGINX_BODY_LIMIT_BYTES + 1, 0x61),
    );
    const upstreamDelta = upstreamHits - before;
    evidence('nginx-whole-request-413', result, upstreamDelta);

    expect(result.requestBodyBytes).toBeGreaterThan(NGINX_BODY_LIMIT_BYTES);
    expect(result.status).toBe(413);
    expect(result.headers['x-a6-upstream']).toBeUndefined();
    expect(upstreamDelta).toBe(0);
  });

  it('passes JSON over 1 MiB to the application JSON parser for 413', async () => {
    const jsonBody = Buffer.from(JSON.stringify({ content: 'a'.repeat(MIB + 1024) }));
    const before = upstreamHits;
    const result = await sendBuffer(currentNginx!.port, '/a6/json', 'application/json', jsonBody);
    const upstreamDelta = upstreamHits - before;
    evidence('application-json-413', result, upstreamDelta);

    expect(result.requestBodyBytes).toBeGreaterThan(MIB);
    expect(result.requestBodyBytes).toBeLessThan(NGINX_BODY_LIMIT_BYTES);
    expect(result.status).toBe(413);
    expect(result.headers['x-a6-upstream']).toBe('yes');
    expect(upstreamDelta).toBe(1);
  });
});
