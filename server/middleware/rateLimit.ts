import { Request, Response, NextFunction } from 'express';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests allowed per IP within windowMs
  message?: string; // Custom error message in Arabic
  keyGenerator?: (req: Request) => string;
  statusCode?: number;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'طلبات كتير في وقت قصير. استنى شوية وجرب تاني.',
    keyGenerator = (req: Request) =>
      req.ip ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown_ip',
    statusCode = 429,
  } = options;

  const hits = new Map<string, RateLimitRecord>();

  // Periodic cleanup of expired entries to prevent memory growth
  const cleanup = () => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now >= record.resetTime) {
        hits.delete(key);
      }
    }
  };

  const timer = setInterval(cleanup, Math.min(windowMs, 5 * 60 * 1000));
  if (timer.unref) {
    timer.unref();
  }

  const middleware = (req: Request, res: Response, next: NextFunction): void => {
    // If map grows large, run an inline sweep
    if (hits.size > 2000) {
      cleanup();
    }

    const key = keyGenerator(req);
    const now = Date.now();
    let record = hits.get(key);

    if (!record || now >= record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      hits.set(key, record);
      next();
      return;
    }

    if (record.count >= max) {
      record.count += 1;
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(statusCode).json({
        error: 'TooManyRequests',
        message,
      });
      return;
    }

    record.count += 1;
    next();
  };

  // Expose methods for testing and diagnostics
  middleware.getStore = () => hits;
  middleware.clearStore = () => hits.clear();
  middleware.cleanup = cleanup;

  return middleware;
}
