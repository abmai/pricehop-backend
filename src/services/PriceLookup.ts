import { Context, Effect, Layer } from "effect";

import { CacheError } from "../domain/errors";
import type { ProductSnapshot } from "../domain/types";
import type { ConvexClientService } from "../lib/convexEffect";

export const PRICE_FRESHNESS_WINDOW_HOURS = 24;

export const isFresh = (fetchedAt: string, now: Date = new Date()): boolean => {
	const ageMs = now.getTime() - new Date(fetchedAt).getTime();
	return ageMs <= PRICE_FRESHNESS_WINDOW_HOURS * 60 * 60 * 1000;
};

export interface PriceLookupApi {
	getByUrl: (normalizedUrl: string) => Effect.Effect<ProductSnapshot | undefined, CacheError>;
}

export const PriceLookup = Context.GenericTag<PriceLookupApi>("pricehop/PriceLookup");

export const makePriceLookup = (convexClient: ConvexClientService): PriceLookupApi => ({
	getByUrl: (normalizedUrl) =>
		Effect.gen(function* () {
			const product = yield* convexClient.findProductByNormalizedUrl(normalizedUrl);
			if (!product) {
				return undefined;
			}

			const prices = yield* convexClient.getPricesByProductId(product.id);
			if (prices.length === 0) {
				return undefined;
			}

			const fetchedAt = prices
				.map((price) => price.fetchedAt)
				.sort((left, right) => right.localeCompare(left))[0]!;

			return {
				productId: product.id,
				productUrl: product.normalizedUrl,
				brand: product.brand,
				productName: product.productName,
				prices: prices.map((price) =>
					price.status === "unavailable"
						? {
								region: price.region,
								status: "unavailable" as const,
							}
						: {
								region: price.region,
								currency: price.currency,
								localPrice: price.localPrice,
								usdPrice: price.usdPrice,
								exchangeRate: price.exchangeRate,
								confidence: price.confidence,
							},
				),
				fetchedAt,
			};
		}),
});

export const createPriceLookupLayer = (convexClient: ConvexClientService) =>
	Layer.succeed(PriceLookup, makePriceLookup(convexClient));
