import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimiter } from './rateLimit';
import { Request, Response, NextFunction } from 'express';

interface MockResponse extends Response {
  _statusCode: number;
  _data: any;
  _headers: Record<string, string>;
}

function createMockReqRes(ip = '192.168.1.1') {
  const req = {
    ip,
    headers: {},
    socket: { remoteAddress: ip },
  } as unknown as Request;

  const res: MockResponse = {
    _statusCode: 200,
    _data: null,
    _headers: {},
    status(this: MockResponse, code: number) {
      this._statusCode = code;
      return this;
    },
    json(this: MockResponse, data: any) {
      this._data = data;
      return this;
    },
    setHeader(this: MockResponse, name: string, val: string) {
      this._headers[name] = val;
      return this;
    },
  } as unknown as MockResponse;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

describe('Rate Limiter Middleware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests within the limit', () => {
    const limiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 3,
      message: 'تجاوزت الحد',
    });

    // 1st request
    const r1 = createMockReqRes('1.1.1.1');
    limiter(r1.req, r1.res, r1.next);
    expect(r1.next).toHaveBeenCalledTimes(1);
    expect(r1.res._statusCode).toBe(200);

    // 2nd request
    const r2 = createMockReqRes('1.1.1.1');
    limiter(r2.req, r2.res, r2.next);
    expect(r2.next).toHaveBeenCalledTimes(1);

    // 3rd request (max reached)
    const r3 = createMockReqRes('1.1.1.1');
    limiter(r3.req, r3.res, r3.next);
    expect(r3.next).toHaveBeenCalledTimes(1);
  });

  it('blocks request exceeding the max with 429 status and Retry-After header', () => {
    const limiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 2,
      message: 'تجاوزت الحد الأقصى للمحاولات.',
    });

    const r1 = createMockReqRes('2.2.2.2');
    limiter(r1.req, r1.res, r1.next);
    expect(r1.next).toHaveBeenCalledTimes(1);

    const r2 = createMockReqRes('2.2.2.2');
    limiter(r2.req, r2.res, r2.next);
    expect(r2.next).toHaveBeenCalledTimes(1);

    // 3rd request exceeds limit
    const r3 = createMockReqRes('2.2.2.2');
    limiter(r3.req, r3.res, r3.next);
    expect(r3.next).not.toHaveBeenCalled();
    expect(r3.res._statusCode).toBe(429);
    expect(r3.res._data).toEqual({
      error: 'TooManyRequests',
      message: 'تجاوزت الحد الأقصى للمحاولات.',
    });
    expect(r3.res._headers['Retry-After']).toBeDefined();
  });

  it('resets the rate limit window after windowMs passes', () => {
    const limiter = createRateLimiter({
      windowMs: 10 * 1000,
      max: 1,
    });

    const r1 = createMockReqRes('3.3.3.3');
    limiter(r1.req, r1.res, r1.next);
    expect(r1.next).toHaveBeenCalledTimes(1);

    // Exceed limit
    const r2 = createMockReqRes('3.3.3.3');
    limiter(r2.req, r2.res, r2.next);
    expect(r2.next).not.toHaveBeenCalled();
    expect(r2.res._statusCode).toBe(429);

    // Advance time past the 10s window
    vi.advanceTimersByTime(11 * 1000);

    // Now request should succeed again
    const r3 = createMockReqRes('3.3.3.3');
    limiter(r3.req, r3.res, r3.next);
    expect(r3.next).toHaveBeenCalledTimes(1);
  });

  it('tracks distinct IP addresses independently', () => {
    const limiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 1,
    });

    const r1 = createMockReqRes('10.0.0.1');
    limiter(r1.req, r1.res, r1.next);
    expect(r1.next).toHaveBeenCalledTimes(1);

    // 10.0.0.1 blocked
    const r2 = createMockReqRes('10.0.0.1');
    limiter(r2.req, r2.res, r2.next);
    expect(r2.res._statusCode).toBe(429);

    // 10.0.0.2 should still succeed
    const r3 = createMockReqRes('10.0.0.2');
    limiter(r3.req, r3.res, r3.next);
    expect(r3.next).toHaveBeenCalledTimes(1);
    expect(r3.res._statusCode).toBe(200);
  });

  it('cleans up expired entries periodically to prevent memory leaks', () => {
    const limiter = createRateLimiter({
      windowMs: 5000,
      max: 5,
    });

    const r1 = createMockReqRes('5.5.5.5');
    limiter(r1.req, r1.res, r1.next);
    expect(limiter.getStore().has('5.5.5.5')).toBe(true);

    // Advance time past expiration
    vi.advanceTimersByTime(6000);
    limiter.cleanup();

    expect(limiter.getStore().has('5.5.5.5')).toBe(false);
  });
});
