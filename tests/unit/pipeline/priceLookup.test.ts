import { describe, expect, test } from "bun:test";

import { getOrCreateProduct } from "../../../convex/products";
import { upsertPrices } from "../../../convex/prices";
import { createInMemoryConvexStore } from "../../../convex/store";
import { ALL_SUPPORTED_REGIONS } from "../../../src/domain/regions";
import { createAppRuntime } from "../../../src/layers";
import { priceLookup } from "../../../src/pipeline/priceLookup";

describe("priceLookup pipeline", () => {
	test("returns complete when fresh cached prices exist", async () => {
		const store = createInMemoryConvexStore();
		const product = getOrCreateProduct(store, {
			normalizedUrl: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
			brand: "tiffany",
			rawUrl: "https://www.tiffany.com/jewelry/bracelets/item-123.html?utm_source=google",
		});

		upsertPrices(store, product.id, [
			{
				region: "US",
				currency: "USD",
				localPrice: 12500,
				usdPrice: 12500,
				exchangeRate: 1,
				confidence: "high",
				fetchedAt: new Date().toISOString(),
			},
		]);

		const runtime = createAppRuntime({ store });
		const result = await runtime.runPromise(priceLookup(product.rawUrl));

		expect(result.status).toBe("complete");
		expect(result.brand).toBe("tiffany");
		expect(result.prices).toHaveLength(1);
		expect(store.indexingJobs).toHaveLength(0);
	});

	test("returns indexing with stale prices and creates one job", async () => {
		const store = createInMemoryConvexStore();
		const product = getOrCreateProduct(store, {
			normalizedUrl: "https://www.cartier.com/en-us/jewelry/bracelets/item-123",
			brand: "cartier",
			rawUrl: "https://www.cartier.com/en-us/jewelry/bracelets/item-123?utm_source=meta",
		});

		upsertPrices(store, product.id, [
			{
				region: "US",
				currency: "USD",
				localPrice: 8700,
				usdPrice: 8700,
				exchangeRate: 1,
				confidence: "high",
				fetchedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
			},
		]);

		const runtime = createAppRuntime({ store });
		const result = await runtime.runPromise(priceLookup(product.rawUrl));

		expect(result.status).toBe("indexing");
		expect(result.prices).toHaveLength(1);
		expect(store.indexingJobs).toHaveLength(1);
		expect(store.indexingJobs[0]?.regions).toEqual([...ALL_SUPPORTED_REGIONS]);
	});

	test("reuses an existing active job for repeated lookups", async () => {
		const store = createInMemoryConvexStore();
		const runtime = createAppRuntime({ store });
		const rawUrl = "https://www.on.com/en-us/products/cloudmonster-123?utm_id=1";

		const first = await runtime.runPromise(priceLookup(rawUrl));
		const second = await runtime.runPromise(priceLookup(rawUrl));

		expect(first.status).toBe("indexing");
		expect(second.status).toBe("indexing");
		if (first.status === "indexing" && second.status === "indexing") {
			expect(second.jobId).toBe(first.jobId);
		}
		expect(store.indexingJobs).toHaveLength(1);
	});
});
