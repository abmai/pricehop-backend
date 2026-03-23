import { Layer, ManagedRuntime } from "effect";

import { createInMemoryConvexStore, type InMemoryConvexStore } from "../convex/store";
import { ConvexClient, makeInMemoryConvexClient } from "./lib/convexEffect";
import { BrandDetectorLive } from "./services/BrandDetector";
import { createCurrencyConverterLayer } from "./services/CurrencyConverter";
import { createExchangeRateLayer, makeExchangeRateService } from "./services/ExchangeRateService";
import { createIndexingJobLayer } from "./services/IndexingJobService";
import {
	createIndexingDispatcherLayer,
	IndexingDispatcherLive,
	IndexingWorkerLive,
	type IndexingDispatcherApi,
} from "./services/IndexingWorker";
import { createPageFetcherLayer, type PageFetcherApi } from "./services/PageFetcher";
import { createPriceExtractorLayer, type PriceExtractorApi } from "./services/PriceExtractor";
import { createPriceLookupLayer } from "./services/PriceLookup";
import { createRegionResolverLayer, type RegionResolverApi } from "./services/RegionResolver";
import { UrlNormalizerLive } from "./services/UrlNormalizer";

export interface AppEnvironmentOptions {
	store?: InMemoryConvexStore;
	pageFetcher?: PageFetcherApi;
	priceExtractor?: PriceExtractorApi;
	regionResolver?: RegionResolverApi;
	indexingDispatcher?: IndexingDispatcherApi;
}

export const makeAppLayer = (options: AppEnvironmentOptions = {}) => {
	const store = options.store ?? createInMemoryConvexStore();
	const convexClient = makeInMemoryConvexClient(store);
	const exchangeRates = makeExchangeRateService(convexClient);
	const baseLayer = Layer.mergeAll(
		UrlNormalizerLive,
		BrandDetectorLive,
		Layer.succeed(ConvexClient, convexClient),
		createExchangeRateLayer(convexClient),
		createCurrencyConverterLayer(exchangeRates),
		createPriceLookupLayer(convexClient),
		createIndexingJobLayer(convexClient),
		createRegionResolverLayer(options.regionResolver),
		createPageFetcherLayer(options.pageFetcher),
		createPriceExtractorLayer(options.priceExtractor),
	);
	const workerLayer = Layer.provide(IndexingWorkerLive, baseLayer);
	const dispatcherLayer = options.indexingDispatcher
		? createIndexingDispatcherLayer(options.indexingDispatcher)
		: Layer.provide(IndexingDispatcherLive, workerLayer);

	return Layer.mergeAll(baseLayer, workerLayer, dispatcherLayer);
};

export const createAppRuntime = (options: AppEnvironmentOptions = {}) =>
	ManagedRuntime.make(makeAppLayer(options));
