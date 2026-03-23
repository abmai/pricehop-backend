import { Context, Effect, Layer } from "effect";

import { CacheError, ExchangeRateError } from "../domain/errors";
import type { CurrencyCode } from "../domain/regions";
import type { ExchangeRateServiceApi } from "./ExchangeRateService";

export interface CurrencyConverterApi {
	toUsd: (
		localPrice: number,
		currency: CurrencyCode,
	) => Effect.Effect<
		{
			usdPrice: number;
			exchangeRate: number;
		},
		ExchangeRateError | CacheError
	>;
}

export const CurrencyConverter = Context.GenericTag<CurrencyConverterApi>(
	"pricehop/CurrencyConverter",
);

export const makeCurrencyConverter = (
	exchangeRates: ExchangeRateServiceApi,
): CurrencyConverterApi => ({
	toUsd: (localPrice, currency) =>
		Effect.map(exchangeRates.getRateToUsd(currency), (rateToUsd) => ({
			usdPrice: Number((localPrice * rateToUsd).toFixed(2)),
			exchangeRate: rateToUsd,
		})),
});

export const createCurrencyConverterLayer = (exchangeRates: ExchangeRateServiceApi) =>
	Layer.succeed(CurrencyConverter, makeCurrencyConverter(exchangeRates));
