import { Context, Effect, Layer } from "effect";

import { CacheError, ExchangeRateError } from "../domain/errors";
import type { CurrencyCode } from "../domain/regions";
import type { ConvexClientService } from "../lib/convexEffect";

export interface ExchangeRateServiceApi {
	getRateToUsd: (currency: CurrencyCode) => Effect.Effect<number, ExchangeRateError | CacheError>;
}

export const ExchangeRateService = Context.GenericTag<ExchangeRateServiceApi>(
	"pricehop/ExchangeRateService",
);

export const makeExchangeRateService = (
	convexClient: ConvexClientService,
): ExchangeRateServiceApi => ({
	getRateToUsd: (currency) =>
		Effect.gen(function* () {
			if (currency === "USD") {
				return 1;
			}

			const rate = yield* convexClient.getExchangeRateByCurrency(currency);
			if (!rate) {
				return yield* Effect.fail(
					new ExchangeRateError({
						currency,
					}),
				);
			}

			return rate.rateToUsd;
		}),
});

export const createExchangeRateLayer = (convexClient: ConvexClientService) =>
	Layer.succeed(ExchangeRateService, makeExchangeRateService(convexClient));
