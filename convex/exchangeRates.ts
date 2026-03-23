import type { CurrencyCode } from "../src/domain/regions";
import type { ExchangeRateRecord } from "./schema";
import type { InMemoryConvexStore } from "./store";

export const getExchangeRateByCurrency = (
	store: InMemoryConvexStore,
	currency: CurrencyCode,
): ExchangeRateRecord | undefined => store.exchangeRates.find((rate) => rate.currency === currency);

export const setExchangeRate = (
	store: InMemoryConvexStore,
	record: ExchangeRateRecord,
): ExchangeRateRecord => {
	const existingIndex = store.exchangeRates.findIndex((rate) => rate.currency === record.currency);

	if (existingIndex >= 0) {
		store.exchangeRates[existingIndex] = record;
	} else {
		store.exchangeRates.push(record);
	}

	return record;
};
