import { Context, Effect } from "effect";

import type { Brand } from "../domain/brands";
import { CacheError, UnsupportedBrandError } from "../domain/errors";
import type { BrandRecord, BrandUrlRecord } from "../../convex/schema";
import type { ConvexClientService } from "../lib/convexEffect";

export interface BrandDetectorService {
	detect: (normalizedUrl: string) => Effect.Effect<Brand, UnsupportedBrandError | CacheError>;
}

export const BrandDetector = Context.GenericTag<BrandDetectorService>("pricehop/BrandDetector");

const matchesHostname = (hostname: string, domain: string): boolean =>
	hostname === domain || hostname.endsWith(`.${domain}`);

const buildBrandHosts = (
	brands: BrandRecord[],
	brandUrls: BrandUrlRecord[],
): Record<Brand, string[]> => {
	const brandsById = new Map(brands.map((brand) => [brand.id, brand]));
	const hostsByBrand = new Map<Brand, Set<string>>();

	for (const brand of brands) {
		hostsByBrand.set(brand.name, new Set([brand.baseHost.toLowerCase()]));
	}

	for (const brandUrl of brandUrls) {
		const brand = brandsById.get(brandUrl.brandId);
		if (!brand) {
			continue;
		}

		const existingHosts = hostsByBrand.get(brand.name) ?? new Set<string>();
		existingHosts.add(new URL(brandUrl.baseUrl).hostname.toLowerCase());
		hostsByBrand.set(brand.name, existingHosts);
	}

	return Object.fromEntries(
		[...hostsByBrand.entries()].map(([brand, hosts]) => [brand, [...hosts]]),
	);
};

export const makeBrandDetector = (convexClient: ConvexClientService): BrandDetectorService => ({
	detect: (normalizedUrl) =>
		Effect.gen(function* () {
			const hostname = new URL(normalizedUrl).hostname.toLowerCase();
			const brands = yield* convexClient.getAllBrands();
			const brandUrls = yield* convexClient.getAllBrandUrls();
			const brandHosts = buildBrandHosts(brands, brandUrls);

			for (const [brand, domains] of Object.entries(brandHosts)) {
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
