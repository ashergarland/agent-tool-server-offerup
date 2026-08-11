import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
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
  private readonly secret = randomBytes(32);
  private readonly apiKeys: ReadonlyArray<{ digest: Buffer; principalId: string }>;

  public constructor(apiKeys: readonly string[]) {
    this.apiKeys = apiKeys.map((value, index) => ({
      digest: this.digest(value),
      principalId: `key:${index + 1}`,
    }));
  }

  private digest(value: string): Buffer {
    return createHmac('sha256', this.secret).update(value, 'utf8').digest();
  }

  public authenticate(request: FastifyRequest): Promise<Principal> {
    const presented = credential(request);
    if (!presented) throw unauthorized('Missing bearer token or x-api-key header');
    const presentedDigest = this.digest(presented);
    const match = this.apiKeys.find((candidate) =>
      timingSafeEqual(candidate.digest, presentedDigest),
    );
    if (!match) throw unauthorized('Invalid API key');
    return Promise.resolve({ id: match.principalId, kind: 'api-key' });
  }
}

export const createAuthenticator = (config: AppConfig): Authenticator =>
  config.auth.mode === 'disabled'
    ? new DisabledAuthenticator()
    : new ApiKeyAuthenticator(config.auth.apiKeys);
