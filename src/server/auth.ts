import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { AppConfig } from '../config/index.js';
import { unauthorized } from '../errors.js';

export interface Principal {
  readonly id: string;
  readonly kind: 'api-key' | 'anonymous';
}

export interface Authenticator {
  authenticate(request: FastifyRequest): Promise<Principal>;
}

const credential = (request: FastifyRequest): string | undefined => {
  const authorization = request.headers.authorization;
  if (typeof authorization === 'string' && authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim() || undefined;
  }
  const apiKey = request.headers['x-api-key'];
  return typeof apiKey === 'string' && apiKey.length > 0 ? apiKey : undefined;
};

class DisabledAuthenticator implements Authenticator {
  public authenticate(): Promise<Principal> {
    return Promise.resolve({ id: 'anonymous', kind: 'anonymous' });
  }
}

class ApiKeyAuthenticator implements Authenticator {
  private readonly apiKeys: ReadonlyArray<{
    digest: Buffer;
    salt: Buffer;
    principalId: string;
  }>;

  public constructor(apiKeys: readonly string[]) {
    this.apiKeys = apiKeys.map((value, index) => {
      const salt = randomBytes(16);
      return {
        digest: scryptSync(value, salt, 64),
        salt,
        principalId: `key:${index + 1}`,
      };
    });
  }

  private digest(value: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(value, salt, 64, (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      });
    });
  }

  public async authenticate(request: FastifyRequest): Promise<Principal> {
    const presented = credential(request);
    if (!presented) throw unauthorized('Missing bearer token or x-api-key header');
    const matches = await Promise.all(
      this.apiKeys.map(async (candidate) =>
        timingSafeEqual(candidate.digest, await this.digest(presented, candidate.salt)),
      ),
    );
    const matchIndex = matches.indexOf(true);
    const principalId = this.apiKeys[matchIndex]?.principalId;
    if (!principalId) throw unauthorized('Invalid API key');
    return { id: principalId, kind: 'api-key' };
  }
}

export const createAuthenticator = (config: AppConfig): Authenticator =>
  config.auth.mode === 'disabled'
    ? new DisabledAuthenticator()
    : new ApiKeyAuthenticator(config.auth.apiKeys);
