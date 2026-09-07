import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

export class TooManyRequestsException extends HttpException {
  constructor() {
    super('Rate limit exceeded.', HttpStatus.TOO_MANY_REQUESTS);
  }
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  expensiveMaxRequests: number;
  now?: () => number;
  expensivePrefixes?: readonly string[];
}

interface RequestLike {
  ip?: string;
  path?: string;
  originalUrl?: string;
  url?: string;
  socket?: { remoteAddress?: string };
}

interface Bucket {
  startedAt: number;
  count: number;
}

const DEFAULT_EXPENSIVE_PREFIXES = [
  '/api/ai-tools',
  '/api/grounded-generation',
  '/api/academic-search',
  '/api/document-input',
  '/api/zotero',
] as const;
const MAX_BUCKETS = 10_000;

@Injectable()
export class ProcessLocalRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private readonly now: () => number;
  private readonly expensivePrefixes: readonly string[];

  constructor(
    private readonly options: RateLimitOptions = {
      windowMs: 60_000,
      maxRequests: 120,
      expensiveMaxRequests: 30,
    },
  ) {
    this.now = options.now ?? (() => Date.now());
    this.expensivePrefixes = options.expensivePrefixes ?? DEFAULT_EXPENSIVE_PREFIXES;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestLike>();
    const path = request.path || request.originalUrl || request.url || '/';
    const expensive = this.expensivePrefixes.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
    const limit = expensive
      ? this.options.expensiveMaxRequests
      : this.options.maxRequests;
    const key = `${this.clientKey(request)}:${expensive ? 'expensive' : 'general'}`;
    const now = this.now();
    this.prune(now);
    this.evictIfFull();
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.startedAt >= this.options.windowMs) {
      this.buckets.set(key, { startedAt: now, count: 1 });
      return true;
    }
    if (bucket.count >= limit) {
      throw new TooManyRequestsException();
    }
    bucket.count += 1;
    return true;
  }

  private clientKey(request: RequestLike): string {
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.startedAt >= this.options.windowMs) this.buckets.delete(key);
    }
  }

  private evictIfFull(): void {
    if (this.buckets.size < MAX_BUCKETS) return;
    const oldest = this.buckets.keys().next().value as string | undefined;
    if (oldest) this.buckets.delete(oldest);
  }
}
