import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { getOrCreateProduct } from "../../convex/products";
import { upsertPrices } from "../../convex/prices";
import { createInMemoryConvexStore } from "../../convex/store";
import { createApp } from "../../src/index";
import type { IndexingDispatcherApi } from "../../src/services/IndexingWorker";

const NoopDispatcher: IndexingDispatcherApi = {
	dispatch: () => Effect.void,
};

describe("price lookup API", () => {
	test("returns complete for fresh cached prices", async () => {
		const store = createInMemoryConvexStore();
		const product = getOrCreateProduct(store, {
			normalizedUrl: "https://www.bottegaveneta.com/en-us/women/jewelry/item-123.html",
			brand: "bottega-veneta",
			rawUrl: "https://www.bottegaveneta.com/en-us/women/jewelry/item-123.html?utm_source=search",
			productName: "Drop Earring",
		});

		upsertPrices(store, product.id, [
			{
				region: "US",
				currency: "USD",
				localPrice: 980,
				usdPrice: 980,
				exchangeRate: 1,
				confidence: "high",
				fetchedAt: new Date().toISOString(),
			},
		]);

		const app = createApp({ store, indexingDispatcher: NoopDispatcher });
		const response = await app.request("http://localhost/prices/lookup", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ url: product.rawUrl }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.status).toBe("complete");
		expect(body.brand).toBe("bottega-veneta");
		expect(body.prices).toHaveLength(1);
	});

	test("creates an indexing job and exposes its status", async () => {
		const store = createInMemoryConvexStore();
		const app = createApp({ store, indexingDispatcher: NoopDispatcher });

		const lookupResponse = await app.request("http://localhost/prices/lookup", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				url: "https://www.tiffany.com/jewelry/bracelets/item-123.html?ref=123",
			}),
		});

		expect(lookupResponse.status).toBe(202);
		const lookupBody = await lookupResponse.json();
		expect(lookupBody.status).toBe("indexing");

		const statusResponse = await app.request(`http://localhost/prices/status/${lookupBody.jobId}`);

		expect(statusResponse.status).toBe(200);
		const statusBody = await statusResponse.json();
		expect(statusBody.status).toBe("pending");
	});

	test("returns a 400 for unsupported brands", async () => {
		const app = createApp();

		const response = await app.request("http://localhost/prices/lookup", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ url: "https://example.com/product/123" }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe("UnsupportedBrandError");
	});
});
