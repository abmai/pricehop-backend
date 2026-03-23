import { Layer, ManagedRuntime } from "effect";

import { createInMemoryConvexStore, type InMemoryConvexStore } from "../convex/store";
import { ConvexClient, makeInMemoryConvexClient } from "./lib/convexEffect";
import { BrandDetectorLive } from "./services/BrandDetector";
import { createCurrencyConverterLayer } from "./services/CurrencyConverter";
import { createExchangeRateLayer, makeExchangeRateService } from "./services/ExchangeRateService";
import { createIndexingJobLayer } from "./services/IndexingJobService";
import { createPriceLookupLayer } from "./services/PriceLookup";
import { UrlNormalizerLive } from "./services/UrlNormalizer";

export interface AppEnvironmentOptions {
	store?: InMemoryConvexStore;
}

export const makeAppLayer = (options: AppEnvironmentOptions = {}) => {
	const store = options.store ?? createInMemoryConvexStore();
	const convexClient = makeInMemoryConvexClient(store);
	const exchangeRates = makeExchangeRateService(convexClient);

	return Layer.mergeAll(
		UrlNormalizerLive,
		BrandDetectorLive,
		Layer.succeed(ConvexClient, convexClient),
		createExchangeRateLayer(convexClient),
		createCurrencyConverterLayer(exchangeRates),
		createPriceLookupLayer(convexClient),
		createIndexingJobLayer(convexClient),
	);
};

export const createAppRuntime = (options: AppEnvironmentOptions = {}) =>
	ManagedRuntime.make(makeAppLayer(options));
