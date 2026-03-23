import { Context, Effect } from "effect";

import { getExchangeRateByCurrency, setExchangeRate } from "../../convex/exchangeRates";
import {
	createIndexingJob,
	findActiveIndexingJobByProductId,
	getIndexingJobById,
	updateIndexingJobStatus,
} from "../../convex/indexingJobs";
import {
	findProductByNormalizedUrl,
	getOrCreateProduct,
	getProductById,
	updateProductName,
	type CreateProductInput,
} from "../../convex/products";
import { getPricesByProductId, upsertPrices, type UpsertPriceInput } from "../../convex/prices";
import { createInMemoryConvexStore, type InMemoryConvexStore } from "../../convex/store";
import { CacheError } from "../domain/errors";
import type { CurrencyCode, Region } from "../domain/regions";
import type {
	ExchangeRateRecord,
	IndexingJobRecord,
	ProductRecord,
	StoredPriceRecord,
} from "../../convex/schema";

export interface ConvexClientService {
	findProductByNormalizedUrl: (
		normalizedUrl: string,
	) => Effect.Effect<ProductRecord | undefined, CacheError>;
	getProductById: (productId: string) => Effect.Effect<ProductRecord | undefined, CacheError>;
	getOrCreateProduct: (input: CreateProductInput) => Effect.Effect<ProductRecord, CacheError>;
	updateProductName: (
		productId: string,
		productName: string,
	) => Effect.Effect<ProductRecord | undefined, CacheError>;
	getPricesByProductId: (productId: string) => Effect.Effect<StoredPriceRecord[], CacheError>;
	upsertPrices: (
		productId: string,
		prices: UpsertPriceInput[],
	) => Effect.Effect<StoredPriceRecord[], CacheError>;
	findActiveIndexingJobByProductId: (
		productId: string,
	) => Effect.Effect<IndexingJobRecord | undefined, CacheError>;
	createIndexingJob: (
		productId: string,
		regions: Region[],
	) => Effect.Effect<IndexingJobRecord, CacheError>;
	getIndexingJobById: (jobId: string) => Effect.Effect<IndexingJobRecord | undefined, CacheError>;
	updateIndexingJobStatus: (
		jobId: string,
		status: IndexingJobRecord["status"],
		options?: {
			error?: string;
			completedAt?: string;
		},
	) => Effect.Effect<IndexingJobRecord | undefined, CacheError>;
	getExchangeRateByCurrency: (
		currency: CurrencyCode,
	) => Effect.Effect<ExchangeRateRecord | undefined, CacheError>;
	setExchangeRate: (record: ExchangeRateRecord) => Effect.Effect<ExchangeRateRecord, CacheError>;
}

export const ConvexClient = Context.GenericTag<ConvexClientService>("pricehop/ConvexClient");

const wrapCacheOperation = <T>(operation: string, execute: () => T): Effect.Effect<T, CacheError> =>
	Effect.try({
		try: execute,
		catch: (cause) =>
			new CacheError({
				operation,
				cause,
			}),
	});

export const makeInMemoryConvexClient = (
	store: InMemoryConvexStore = createInMemoryConvexStore(),
): ConvexClientService => ({
	findProductByNormalizedUrl: (normalizedUrl) =>
		wrapCacheOperation("findProductByNormalizedUrl", () =>
			findProductByNormalizedUrl(store, normalizedUrl),
		),
	getProductById: (productId) =>
		wrapCacheOperation("getProductById", () => getProductById(store, productId)),
	getOrCreateProduct: (input) =>
		wrapCacheOperation("getOrCreateProduct", () => getOrCreateProduct(store, input)),
	updateProductName: (productId, productName) =>
		wrapCacheOperation("updateProductName", () => updateProductName(store, productId, productName)),
	getPricesByProductId: (productId) =>
		wrapCacheOperation("getPricesByProductId", () => getPricesByProductId(store, productId)),
	upsertPrices: (productId, prices) =>
		wrapCacheOperation("upsertPrices", () => upsertPrices(store, productId, prices)),
	findActiveIndexingJobByProductId: (productId) =>
		wrapCacheOperation("findActiveIndexingJobByProductId", () =>
			findActiveIndexingJobByProductId(store, productId),
		),
	createIndexingJob: (productId, regions) =>
		wrapCacheOperation("createIndexingJob", () => createIndexingJob(store, { productId, regions })),
	getIndexingJobById: (jobId) =>
		wrapCacheOperation("getIndexingJobById", () => getIndexingJobById(store, jobId)),
	updateIndexingJobStatus: (jobId, status, options) =>
		wrapCacheOperation("updateIndexingJobStatus", () =>
			updateIndexingJobStatus(store, jobId, status, options),
		),
	getExchangeRateByCurrency: (currency) =>
		wrapCacheOperation("getExchangeRateByCurrency", () =>
			getExchangeRateByCurrency(store, currency),
		),
	setExchangeRate: (record) =>
		wrapCacheOperation("setExchangeRate", () => setExchangeRate(store, record)),
});
