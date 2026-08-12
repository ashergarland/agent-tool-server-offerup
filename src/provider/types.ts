export interface ProviderAvailability {
  readonly status: 'unavailable';
  readonly configured: false;
  readonly authorizedApiFound: false;
  readonly marketplaceCapabilitiesAvailable: false;
  readonly reason: string;
  readonly enablementRequirements: readonly string[];
}

/** Boundary for a future provider authorized by OfferUp. */
export interface OfferUpProvider {
  getAvailability(): Promise<ProviderAvailability>;
}
