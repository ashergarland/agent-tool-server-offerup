import type { OfferUpProvider } from '../provider/types.js';
import { IntegrationService } from './integration.js';

export interface Services {
  readonly integration: IntegrationService;
}

export const createServices = (provider: OfferUpProvider): Services => ({
  integration: new IntegrationService(provider),
});
