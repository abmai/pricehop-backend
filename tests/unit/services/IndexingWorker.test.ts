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
import { MockScrapingBeeService } from "../../../src/services/ScrapingBeeService";

const seedRates = (store: ReturnType<typeof createInMemoryConvexStore>) => {
	setExchangeRate(store, { currency: "USD", rateToUsd: 1, fetchedAt: new Date().toISOString() });
	setExchangeRate(store, { currency: "CAD", rateToUsd: 0.74, fetchedAt: new Date().toISOString() });
	setExchangeRate(store, { currency: "AUD", rateToUsd: 0.65, fetchedAt: new Date().toISOString() });
};

describe("IndexingWorker", () => {
	test("extracts source product, searches target regions, and stores prices", async () => {
		const store = createInMemoryConvexStore();
		const convexClient = makeInMemoryConvexClient(store);
		seedRates(store);
		const product = getOrCreateProduct(store, {
			normalizedUrl: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
			brand: "tiffany",
			rawUrl: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
		});
		const job = createIndexingJob(store, {
			productId: product.id,
			regions: ["US", "CA"],
		});

		const scrapingBee = new MockScrapingBeeService({
			extractFixtures: {
				"https://www.tiffany.com/jewelry/bracelets/item-123.html": {
					name: "Tiffany T Bracelet",
					price: "$2,200.00",
					currency: "USD",
					skus: "1366369751",
					countryCode: "US",
					available: true,
				},
				"https://www.tiffany.ca/jewelry/bracelets/item-123.html": {
					name: "Tiffany T Bracelet",
					price: "C$3,050.00",
					currency: "CAD",
					skus: "1366369751",
					countryCode: "CA",
					available: true,
				},
			},
			searchFixtures: {
				"Tiffany T Bracelet 1366369751 canadian price:ca":
					"https://www.tiffany.ca/jewelry/bracelets/item-123.html",
			},
		});

		const worker = makeIndexingWorker(
			convexClient,
			scrapingBee,
			makeCurrencyConverter(makeExchangeRateService(convexClient)),
		);

		await Effect.runPromise(Effect.either(worker.processJob(job.id)));

		expect(store.products[0]?.productName).toBe("Tiffany T Bracelet");
		expect(store.products[0]?.skus).toBe("1366369751");
		expect(store.indexingJobs[0]?.status).toBe("complete");
		expect(store.prices).toHaveLength(2);
		expect(store.prices.find((p) => p.region === "US")).toMatchObject({
			region: "US",
			localPrice: 2200,
			currency: "USD",
		});
		expect(store.prices.find((p) => p.region === "CA")).toMatchObject({
			region: "CA",
			localPrice: 3050,
			currency: "CAD",
		});
	});

	test("stores unavailable when extraction says available is false", async () => {
		const store = createInMemoryConvexStore();
		const convexClient = makeInMemoryConvexClient(store);
		seedRates(store);
		const product = getOrCreateProduct(store, {
			normalizedUrl: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
			brand: "tiffany",
			rawUrl: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
		});
		const job = createIndexingJob(store, {
			productId: product.id,
			regions: ["US"],
		});

		const scrapingBee = new MockScrapingBeeService({
			extractFixtures: {
				"https://www.tiffany.com/jewelry/bracelets/item-123.html": {
					name: "Tiffany T Bracelet",
					countryCode: "US",
					available: false,
				},
			},
		});

		const worker = makeIndexingWorker(
			convexClient,
			scrapingBee,
			makeCurrencyConverter(makeExchangeRateService(convexClient)),
		);

		await Effect.runPromise(Effect.either(worker.processJob(job.id)));

		expect(store.indexingJobs[0]?.status).toBe("complete");
		expect(store.prices).toHaveLength(1);
		expect(store.prices[0]).toMatchObject({
			region: "US",
			status: "unavailable",
			confidence: "high",
		});
	});

	test("fails the job when source extraction fails", async () => {
		const store = createInMemoryConvexStore();
		const convexClient = makeInMemoryConvexClient(store);
		const product = getOrCreateProduct(store, {
			normalizedUrl: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
			brand: "tiffany",
			rawUrl: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
		});
		const job = createIndexingJob(store, {
			productId: product.id,
			regions: ["US"],
		});

		const scrapingBee = new MockScrapingBeeService();

		const worker = makeIndexingWorker(
			convexClient,
			scrapingBee,
			makeCurrencyConverter(makeExchangeRateService(convexClient)),
		);

		const outcome = await Effect.runPromise(Effect.either(worker.processJob(job.id)));

		expect(outcome._tag).toBe("Left");
		expect(store.indexingJobs[0]?.status).toBe("failed");
		expect(store.prices).toHaveLength(0);
	});

	test("search returning null is treated as failure, not unavailable", async () => {
		const store = createInMemoryConvexStore();
		const convexClient = makeInMemoryConvexClient(store);
		seedRates(store);
		const product = getOrCreateProduct(store, {
			normalizedUrl: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
			brand: "tiffany",
			rawUrl: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
		});
		const job = createIndexingJob(store, {
			productId: product.id,
			regions: ["US", "CA"],
		});

		const scrapingBee = new MockScrapingBeeService({
			extractFixtures: {
				"https://www.tiffany.com/jewelry/bracelets/item-123.html": {
					name: "Tiffany T Bracelet",
					price: "$2,200.00",
					currency: "USD",
					countryCode: "US",
					available: true,
				},
			},
			searchFallback: () => null,
		});

		const worker = makeIndexingWorker(
			convexClient,
			scrapingBee,
			makeCurrencyConverter(makeExchangeRateService(convexClient)),
		);

		await Effect.runPromise(Effect.either(worker.processJob(job.id)));

		expect(store.indexingJobs[0]?.status).toBe("complete");
		expect(store.prices).toHaveLength(1);
		expect(store.prices[0]?.region).toBe("US");
		expect(store.prices.find((p) => p.region === "CA")).toBeUndefined();
	});

	test("source country not in supported regions still searches all job regions", async () => {
		const store = createInMemoryConvexStore();
		const convexClient = makeInMemoryConvexClient(store);
		seedRates(store);
		const product = getOrCreateProduct(store, {
			normalizedUrl: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
			brand: "tiffany",
			rawUrl: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
		});
		const job = createIndexingJob(store, {
			productId: product.id,
			regions: ["US"],
		});

		const scrapingBee = new MockScrapingBeeService({
			extractFixtures: {
				"https://www.tiffany.com/jewelry/bracelets/item-123.html": {
					name: "Tiffany T Bracelet",
					price: "¥280,000",
					currency: "JPY",
					countryCode: "JP",
					available: true,
				},
				"https://www.tiffany.com/found-us.html": {
					name: "Tiffany T Bracelet",
					price: "$2,200.00",
					currency: "USD",
					countryCode: "US",
					available: true,
				},
			},
			searchFixtures: {
				"Tiffany T Bracelet american price:us":
					"https://www.tiffany.com/found-us.html",
			},
		});

		const worker = makeIndexingWorker(
			convexClient,
			scrapingBee,
			makeCurrencyConverter(makeExchangeRateService(convexClient)),
		);

		await Effect.runPromise(Effect.either(worker.processJob(job.id)));

		expect(store.indexingJobs[0]?.status).toBe("complete");
		expect(store.prices).toHaveLength(1);
		expect(store.prices[0]?.region).toBe("US");
	});

	test("wrong hostname in search result is treated as failure", async () => {
		const store = createInMemoryConvexStore();
		const convexClient = makeInMemoryConvexClient(store);
		seedRates(store);
		const product = getOrCreateProduct(store, {
			normalizedUrl: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
			brand: "tiffany",
			rawUrl: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
		});
		const job = createIndexingJob(store, {
			productId: product.id,
			regions: ["US", "CA"],
		});

		const scrapingBee = new MockScrapingBeeService({
			extractFixtures: {
				"https://www.tiffany.com/jewelry/bracelets/item-123.html": {
					name: "Tiffany T Bracelet",
					price: "$2,200.00",
					currency: "USD",
					countryCode: "US",
					available: true,
				},
			},
			searchFixtures: {
				"Tiffany T Bracelet canadian price:ca":
					"https://www.amazon.ca/fake-tiffany.html",
			},
		});

		const worker = makeIndexingWorker(
			convexClient,
			scrapingBee,
			makeCurrencyConverter(makeExchangeRateService(convexClient)),
		);

		await Effect.runPromise(Effect.either(worker.processJob(job.id)));

		expect(store.indexingJobs[0]?.status).toBe("complete");
		expect(store.prices).toHaveLength(1);
		expect(store.prices[0]?.region).toBe("US");
		expect(store.prices.find((p) => p.region === "CA")).toBeUndefined();
	});
});
