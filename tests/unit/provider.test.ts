import { describe, expect, it } from 'vitest';
import { UnavailableOfferUpProvider } from '../../src/provider/unavailable.js';
import { createServices } from '../../src/services/index.js';

describe('unavailable OfferUp provider', () => {
  it('reports an honest blocked integration without marketplace capabilities', async () => {
    const provider = new UnavailableOfferUpProvider();
    const result = await provider.getAvailability();
    expect(result).toMatchObject({
      status: 'unavailable',
      configured: false,
      authorizedApiFound: false,
      marketplaceCapabilitiesAvailable: false,
    });
    expect(result.enablementRequirements).not.toHaveLength(0);
    await expect(createServices(provider).integration.status()).resolves.toEqual(result);
  });

  it('does not define marketplace or mutation methods', () => {
    const prototype = Object.getOwnPropertyNames(UnavailableOfferUpProvider.prototype);
    expect(prototype).toEqual(['constructor', 'getAvailability']);
  });
});
