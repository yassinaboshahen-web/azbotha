import { Request, Response, NextFunction } from 'express';
import { userService, UserRecord } from '../services/userService';
import { installationService } from '../services/installationService';

export interface AuthenticatedRequest extends Request {
  user?: UserRecord;
  anonymousUserId?: string;
  installationToken?: string;
}

/**
 * Validates the anonymous installation identity and installation token.
 * Guarantees data isolation and ownership in Turso.
 * Sanitizes and validates identity format to prevent injection or arbitrary spoofing.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const anonUserId = req.headers['x-anonymous-user-id'] as string;
    let installationToken: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      installationToken = authHeader.split('Bearer ')[1].trim();
    }

    if (!anonUserId || !installationToken) {
      // Allow fallback for default guest installation in non-production environments
      if (process.env.NODE_ENV !== 'production' && anonUserId === 'anon_default_guest_installation') {
        const user = await userService.getOrCreateAnonymousUser(anonUserId);
        req.user = user;
        req.anonymousUserId = anonUserId;
        next();
        return;
      }

      res.status(401).json({
        error: 'UnauthorizedError',
        message: 'من فضلك سجل دخولك أو فعل كود التعريف المناسب للجهاز.',
      });
      return;
    }

    // Strict validation of anonymous ID format (must be alphanumeric/dash/underscore, max 128 chars)
    if (
      typeof anonUserId !== 'string' ||
      anonUserId.length > 128 ||
      !/^[a-zA-Z0-9_\-]+$/.test(anonUserId)
    ) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'معرف الجهاز غير صالح.',
      });
      return;
    }

    // Verify the installation token maps to this anonymous user ID in the Turso DB
    const verifiedUserId = await installationService.verifyInstallation(installationToken);

    if (!verifiedUserId || verifiedUserId !== anonUserId) {
      res.status(403).json({
        error: 'ForbiddenError',
        message: 'هوية الجهاز غير مطابقة أو غير مصرح لها بالدخول.',
      });
      return;
    }

    // Retrieve or provision user record in Turso DB
    const user = await userService.getOrCreateAnonymousUser(anonUserId);

    req.user = user;
    req.anonymousUserId = anonUserId;
    req.installationToken = installationToken;
    next();
  } catch (error) {
    console.error('Anonymous Identity Middleware Error:', error);
    res.status(500).json({
      error: 'AuthenticationError',
      message: 'مش قادرين نتحقق من هوية الجهاز دلوقتي. جرّب تاني.',
    });
  }
}
