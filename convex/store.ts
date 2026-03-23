import type {
	ExchangeRateRecord,
	IndexingJobRecord,
	ProductRecord,
	StoredPriceRecord,
} from "./schema";

export interface InMemoryConvexStore {
	products: ProductRecord[];
	prices: StoredPriceRecord[];
	indexingJobs: IndexingJobRecord[];
	exchangeRates: ExchangeRateRecord[];
	counters: {
		product: number;
		job: number;
	};
}

export const createInMemoryConvexStore = (): InMemoryConvexStore => ({
	products: [],
	prices: [],
	indexingJobs: [],
	exchangeRates: [],
	counters: {
		product: 0,
		job: 0,
	},
});

export const nextProductId = (store: InMemoryConvexStore): string => {
	store.counters.product += 1;
	return `product_${store.counters.product.toString().padStart(4, "0")}`;
};

export const nextJobId = (store: InMemoryConvexStore): string => {
	store.counters.job += 1;
	return `job_${store.counters.job.toString().padStart(4, "0")}`;
};
