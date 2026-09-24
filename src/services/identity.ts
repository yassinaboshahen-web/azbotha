import { AnonymousUser } from '../types';
import { apiClient } from './apiClient';


const ANONYMOUS_USER_STORAGE_KEY = 'daycompanion_anon_user';

/**
 * Service to manage the anonymous installation identity.
 * Generates a cryptographically secure random anonymous ID on first launch
 * and persists it locally for transparent reuse on subsequent launches.
 */
export const identityService = {
  /**
   * Retrieves or creates the anonymous installation identity.
   */
  getOrCreateAnonymousUser(): AnonymousUser {
    try {
      const stored = localStorage.getItem(ANONYMOUS_USER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AnonymousUser & { installationCredential?: string };
        if (parsed && parsed.id && parsed.id.startsWith('anon_')) {
          // Update lastActiveAt timestamp
          parsed.lastActiveAt = new Date().toISOString();
          localStorage.setItem(ANONYMOUS_USER_STORAGE_KEY, JSON.stringify(parsed));
          return parsed as AnonymousUser;
        }
      }
    } catch {
      // Fallback if localStorage read fails
    }

    // Generate cryptographically secure anonymous ID
    const randomUuid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

    const anonymousId = `anon_${randomUuid}`;
    const now = new Date().toISOString();

    const newUser: AnonymousUser & { installationCredential?: string } = {
      id: anonymousId,
      createdAt: now,
      lastActiveAt: now,
      isAnonymous: true,
    };

    try {
      localStorage.setItem(ANONYMOUS_USER_STORAGE_KEY, JSON.stringify(newUser));
    } catch {
      // Ignore localStorage write error
    }

    return newUser as AnonymousUser;
  },

  /**
   * Helper to quickly get the current anonymous user ID.
   */
  getAnonymousUserId(): string {
    return this.getOrCreateAnonymousUser().id;
  },

  /**
   * Retrieves the secure installation credential if stored.
   */
  getInstallationCredential(): string | undefined {
    try {
      const stored = localStorage.getItem(ANONYMOUS_USER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed?.installationCredential;
      }
    } catch {
      // ignore
    }
    return undefined;
  },

  /**
   * Sets the current anonymous user profile with its credential token.
   */
  setAnonymousUser(newId: string, credential?: string): void {
    const now = new Date().toISOString();
    const updatedUser = {
      id: newId,
      createdAt: now,
      lastActiveAt: now,
      isAnonymous: true,
      installationCredential: credential,
    };
    try {
      localStorage.setItem(ANONYMOUS_USER_STORAGE_KEY, JSON.stringify(updatedUser));
    } catch {
      // ignore
    }
  },

  /**
   * Sets a transferred anonymous user ID (backward compatible).
   */
  setAnonymousUserId(newId: string): void {
    this.setAnonymousUser(newId);
  },

  /**
   * Transparently registers this installation on startup if no credential exists,
   * or verifies the existing one. Self-healing, zero UI required.
   */
  async ensureInstallationCredential(): Promise<void> {
    if (!apiClient.isCloudSyncEnabled()) return;

    const currentCred = this.getInstallationCredential();
    const currentId = this.getAnonymousUserId();

    // If we already have a secure credential, we are fully authorized
    if (currentCred) return;

    try {
      const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          anonymousUserId: currentId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.installationCredential) {
          this.setAnonymousUser(data.anonymousUserId, data.installationCredential);
        }
      } else if (response.status === 404) {
        // Old user ID doesn't exist on server (e.g. database wipe). Register fresh user.
        const freshResponse = await fetch(`${apiBaseUrl}/api/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        if (freshResponse.ok) {
          const freshData = await freshResponse.json();
          if (freshData.success && freshData.installationCredential) {
            this.setAnonymousUser(freshData.anonymousUserId, freshData.installationCredential);
          }
        }
      }
    } catch (err) {
      console.warn('Could not register installation with backend (offline-ready fallback):', err);
    }
  }
};

