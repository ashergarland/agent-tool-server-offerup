import type { OfferUpProvider, ProviderAvailability } from '../provider/types.js';

export class IntegrationService {
  public constructor(private readonly provider: OfferUpProvider) {}

  public status(): Promise<ProviderAvailability> {
    return this.provider.getAvailability();
  }
}
