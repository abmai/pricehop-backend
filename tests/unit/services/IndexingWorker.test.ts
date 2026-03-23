import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createIndexingJob } from "../../../convex/indexingJobs";
import { getOrCreateProduct } from "../../../convex/products";
import { setExchangeRate } from "../../../convex/exchangeRates";
import { createInMemoryConvexStore } from "../../../convex/store";
import { makeInMemoryConvexClient } from "../../../src/lib/convexEffect";
import { makeCurrencyConverter } from "../../../src/services/CurrencyConverter";
import { makeExchangeRateService } from "../../../src/services/ExchangeRateService";
import { makeIndexingWorker } from "../../../src/services/IndexingWorker";
import { MockPageFetcher } from "../../../src/services/PageFetcher";
import { MockPriceExtractor } from "../../../src/services/PriceExtractor";
import { makeRegionResolver } from "../../../src/services/RegionResolver";

describe("IndexingWorker", () => {
	test("stores successful and unavailable regional results and completes the job", async () => {
		const store = createInMemoryConvexStore();
		const product = getOrCreateProduct(store, {
			normalizedUrl: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
			brand: "tiffany",
			rawUrl: "https://www.tiffany.com/jewelry/bracelets/item-123.html?ref=ads",
		});
		const job = createIndexingJob(store, {
			productId: product.id,
			regions: ["US", "CA", "KR"],
		});
		setExchangeRate(store, {
			currency: "CAD",
			rateToUsd: 0.74,
			fetchedAt: new Date().toISOString(),
		});

		const worker = makeIndexingWorker(
			makeInMemoryConvexClient(store),
			makeRegionResolver(),
			new MockPageFetcher({
				fallback: (url) => `<html><body>${url}</body></html>`,
			}),
			new MockPriceExtractor({
				handler: (_html, context) => {
					if (context.region === "US") {
						return {
							productName: "Tiffany T Bracelet",
							sku: "1366369751",
							available: true,
							localPrice: 2200,
							currency: "USD",
							confidence: "high",
						};
					}

					if (context.region === "CA") {
						return {
							productName: "Tiffany T Bracelet",
							available: false,
							confidence: "medium",
						};
					}

					throw new Error("captcha blocked");
				},
			}),
			makeCurrencyConverter(makeExchangeRateService(makeInMemoryConvexClient(store))),
		);

		await Effect.runPromise(Effect.either(worker.processJob(job.id)));

		expect(store.products[0]?.productName).toBe("Tiffany T Bracelet");
		expect(store.indexingJobs[0]?.status).toBe("complete");
		expect(store.indexingJobs[0]?.error).toContain("captcha blocked");
		expect(store.prices).toHaveLength(2);
		expect(store.prices.find((price) => price.region === "US")).toMatchObject({
			region: "US",
			localPrice: 2200,
			usdPrice: 2200,
		});
		expect(store.prices.find((price) => price.region === "CA")).toMatchObject({
			region: "CA",
			status: "unavailable",
		});
	});

	test("fails the job when every region fails", async () => {
		const store = createInMemoryConvexStore();
		const product = getOrCreateProduct(store, {
			normalizedUrl: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
			brand: "tiffany",
			rawUrl: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
		});
		const job = createIndexingJob(store, {
			productId: product.id,
			regions: ["US"],
		});

		const worker = makeIndexingWorker(
			makeInMemoryConvexClient(store),
			makeRegionResolver(),
			new MockPageFetcher(),
			new MockPriceExtractor(),
			makeCurrencyConverter(makeExchangeRateService(makeInMemoryConvexClient(store))),
		);

		const outcome = await Effect.runPromise(Effect.either(worker.processJob(job.id)));

		expect(outcome._tag).toBe("Left");
		expect(store.indexingJobs[0]?.status).toBe("failed");
		expect(store.prices).toHaveLength(0);
	});
});
