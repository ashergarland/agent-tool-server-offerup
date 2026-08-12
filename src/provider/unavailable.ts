import type { OfferUpProvider, ProviderAvailability } from './types.js';

const availability: ProviderAvailability = {
  status: 'unavailable',
  configured: false,
  authorizedApiFound: false,
  marketplaceCapabilitiesAvailable: false,
  reason: 'No public, authorized OfferUp marketplace API for third-party listing access was found.',
  enablementRequirements: [
    'A written OfferUp partner agreement authorizing the intended use case',
    'Official API documentation, endpoint base URL, and version',
    'Documented authentication, scopes, quotas, and data-handling requirements',
    'Sandbox credentials and representative response schemas',
  ],
};

export class UnavailableOfferUpProvider implements OfferUpProvider {
  public getAvailability(): Promise<ProviderAvailability> {
    return Promise.resolve(availability);
  }
}
