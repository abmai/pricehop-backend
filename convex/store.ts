import type {
	BrandRecord,
	BrandUrlRecord,
	ExchangeRateRecord,
	IndexingJobRecord,
	ProductRecord,
	StoredPriceRecord,
} from "./schema";
import { seedBrandData } from "./seed";

export interface InMemoryConvexStore {
	products: ProductRecord[];
	prices: StoredPriceRecord[];
	indexingJobs: IndexingJobRecord[];
	exchangeRates: ExchangeRateRecord[];
	brands: BrandRecord[];
	brandUrls: BrandUrlRecord[];
	counters: {
		product: number;
		job: number;
		brand: number;
		brandUrl: number;
	};
}

export const createInMemoryConvexStore = (): InMemoryConvexStore => {
	const store: InMemoryConvexStore = {
		products: [],
		prices: [],
		indexingJobs: [],
		exchangeRates: [],
		brands: [],
		brandUrls: [],
		counters: {
			product: 0,
			job: 0,
			brand: 0,
			brandUrl: 0,
		},
	};

	seedBrandData(store);
	return store;
};

export const nextProductId = (store: InMemoryConvexStore): string => {
	store.counters.product += 1;
	return `product_${store.counters.product.toString().padStart(4, "0")}`;
};

export const nextJobId = (store: InMemoryConvexStore): string => {
	store.counters.job += 1;
	return `job_${store.counters.job.toString().padStart(4, "0")}`;
};

export const nextBrandId = (store: InMemoryConvexStore): string => {
	store.counters.brand += 1;
	return `brand_${store.counters.brand.toString().padStart(4, "0")}`;
};

export const nextBrandUrlId = (store: InMemoryConvexStore): string => {
	store.counters.brandUrl += 1;
	return `brand_url_${store.counters.brandUrl.toString().padStart(4, "0")}`;
};
