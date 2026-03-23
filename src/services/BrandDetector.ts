import { Context, Effect, Layer } from "effect";

import { BRAND_HOSTS, type Brand } from "../domain/brands";
import { UnsupportedBrandError } from "../domain/errors";

export interface BrandDetectorService {
	detect: (normalizedUrl: string) => Effect.Effect<Brand, UnsupportedBrandError>;
}

export const BrandDetector = Context.GenericTag<BrandDetectorService>("pricehop/BrandDetector");

const matchesHostname = (hostname: string, domain: string): boolean =>
	hostname === domain || hostname.endsWith(`.${domain}`);

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
