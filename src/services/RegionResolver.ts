import { Context, Effect, Layer } from "effect";

import type { Brand } from "../domain/brands";
import { CacheError, ScrapingError } from "../domain/errors";
import type { Region } from "../domain/regions";
import type { ConvexClientService } from "../lib/convexEffect";

export interface RegionResolverApi {
	resolve: (
		productUrl: string,
		brand: Brand,
		region: Region,
	) => Effect.Effect<string, ScrapingError | CacheError>;
}

export const RegionResolver = Context.GenericTag<RegionResolverApi>("pricehop/RegionResolver");

const LOCALE_PREFIX_PATTERN = /^\/[a-z]{2}-[a-z]{2}(?=\/|$)/iu;

const stripLocalePrefix = (pathname: string): string =>
	pathname.replace(LOCALE_PREFIX_PATTERN, "") || "/";

const joinPath = (...parts: string[]): string => {
	const normalized = parts
		.filter((part) => part.length > 0)
		.map((part) => part.replace(/^\/+/u, "").replace(/\/+$/u, ""))
		.filter((part) => part.length > 0);

	return normalized.length === 0 ? "/" : `/${normalized.join("/")}`;
};

export const makeRegionResolver = (convexClient: ConvexClientService): RegionResolverApi => ({
	resolve: (productUrl, brand, region) =>
		Effect.gen(function* () {
			const brandRecord = yield* convexClient.getBrandByName(brand);
			if (!brandRecord) {
				return yield* Effect.fail(
					new ScrapingError({
						url: productUrl,
						cause: `No brand mapping for ${brand}`,
					}),
				);
			}

			const entry = yield* convexClient.getBrandUrlByBrandIdAndRegion(brandRecord.id, region);
			if (!entry) {
				return yield* Effect.fail(
					new ScrapingError({
						url: productUrl,
						cause: `No regional site mapping for ${brand} ${region}`,
					}),
				);
			}

			return yield* Effect.try({
				try: () => {
					const sourceUrl = new URL(productUrl);
					const targetUrl = new URL(entry.baseUrl);
					const sourcePath = sourceUrl.pathname || "/";

					targetUrl.pathname =
						entry.urlTransform === "locale-prefix"
							? joinPath(
									targetUrl.pathname,
									entry.localePrefix ?? "",
									stripLocalePrefix(sourcePath),
								)
							: joinPath(targetUrl.pathname, sourcePath);
					targetUrl.search = "";
					targetUrl.hash = "";

					return targetUrl.toString();
				},
				catch: (cause) =>
					new ScrapingError({
						url: productUrl,
						cause,
					}),
			});
		}),
});

export const createRegionResolverLayer = (
	resolver: RegionResolverApi | undefined,
	convexClient: ConvexClientService,
) => Layer.succeed(RegionResolver, resolver ?? makeRegionResolver(convexClient));
