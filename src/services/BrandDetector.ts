import { Context, Effect, Layer } from "effect";

import type { Brand } from "../domain/brands";
import { REGIONAL_SITES } from "../domain/regionalSites";
import { BRAND_REGISTRY } from "../domain/brandRegistry";
import { UnsupportedBrandError } from "../domain/errors";

export interface BrandDetectorService {
	detect: (normalizedUrl: string) => Effect.Effect<Brand, UnsupportedBrandError>;
}

export const BrandDetector = Context.GenericTag<BrandDetectorService>("pricehop/BrandDetector");

const matchesHostname = (hostname: string, domain: string): boolean =>
	hostname === domain || hostname.endsWith(`.${domain}`);

const BRAND_HOSTS = Object.fromEntries(
	BRAND_REGISTRY.map((config) => {
		const regionalHosts = REGIONAL_SITES.filter((entry) => entry.brand === config.brand).map(
			(entry) => new URL(entry.baseUrl).hostname.toLowerCase(),
		);

		return [config.brand, [...new Set([config.baseHost, ...regionalHosts])]];
	}),
) as Record<Brand, string[]>;

export const makeBrandDetector = (): BrandDetectorService => ({
	detect: (normalizedUrl) =>
		Effect.gen(function* () {
			const hostname = new URL(normalizedUrl).hostname.toLowerCase();

			for (const [brand, domains] of Object.entries(BRAND_HOSTS) as [Brand, string[]][]) {
				if (domains.some((domain) => matchesHostname(hostname, domain))) {
					return brand;
				}
			}

			return yield* Effect.fail(
				new UnsupportedBrandError({
					hostname,
				}),
			);
		}),
});

export const BrandDetectorLive = Layer.succeed(BrandDetector, makeBrandDetector());
