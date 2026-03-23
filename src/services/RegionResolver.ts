import { Context, Effect, Layer } from "effect";

import type { Brand } from "../domain/brands";
import { ScrapingError } from "../domain/errors";
import { getRegionalSiteEntry } from "../domain/regionalSites";
import type { Region } from "../domain/regions";

export interface RegionResolverApi {
	resolve: (
		productUrl: string,
		brand: Brand,
		region: Region,
	) => Effect.Effect<string, ScrapingError>;
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

export const makeRegionResolver = (): RegionResolverApi => ({
	resolve: (productUrl, brand, region) =>
		Effect.try({
			try: () => {
				const entry = getRegionalSiteEntry(brand, region);
				if (!entry) {
					throw new ScrapingError({
						url: productUrl,
						cause: `No regional site mapping for ${brand} ${region}`,
					});
				}

				const sourceUrl = new URL(productUrl);
				const targetUrl = new URL(entry.baseUrl);
				const sourcePath = sourceUrl.pathname || "/";

				targetUrl.pathname =
					entry.urlTransform === "locale-prefix"
						? joinPath(targetUrl.pathname, entry.localePrefix ?? "", stripLocalePrefix(sourcePath))
						: joinPath(targetUrl.pathname, sourcePath);
				targetUrl.search = "";
				targetUrl.hash = "";

				return targetUrl.toString();
			},
			catch: (cause) =>
				cause instanceof ScrapingError
					? cause
					: new ScrapingError({
							url: productUrl,
							cause,
						}),
		}),
});

export const RegionResolverLive = Layer.succeed(RegionResolver, makeRegionResolver());

export const createRegionResolverLayer = (resolver?: RegionResolverApi) =>
	Layer.succeed(RegionResolver, resolver ?? makeRegionResolver());
