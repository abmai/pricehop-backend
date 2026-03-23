import type { StoredPriceRecord } from "./schema";
import type { InMemoryConvexStore } from "./store";

export type UpsertPriceInput = Omit<StoredPriceRecord, "productId">;

export const getPricesByProductId = (
	store: InMemoryConvexStore,
	productId: string,
): StoredPriceRecord[] =>
	store.prices
		.filter((price) => price.productId === productId)
		.sort((left, right) => left.region.localeCompare(right.region));

export const upsertPrices = (
	store: InMemoryConvexStore,
	productId: string,
	prices: UpsertPriceInput[],
): StoredPriceRecord[] => {
	for (const price of prices) {
		const existingIndex = store.prices.findIndex(
			(stored) => stored.productId === productId && stored.region === price.region,
		);

		const nextRecord: StoredPriceRecord = {
			productId,
			...price,
		};

		if (existingIndex >= 0) {
			store.prices[existingIndex] = nextRecord;
		} else {
			store.prices.push(nextRecord);
		}
	}

	return getPricesByProductId(store, productId);
};
