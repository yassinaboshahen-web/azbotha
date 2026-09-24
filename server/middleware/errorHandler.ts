import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  // Safe server-side logging without sensitive user credentials
  const logMessage = err instanceof Error ? err.message : String(err);
  console.error(`[API Error] ${req.method} ${req.originalUrl}:`, logMessage);

  res.status(500).json({
    error: 'InternalServerError',
    message: 'مش قادرين نحفظها دلوقتي. جرّب تاني.',
  });
}
