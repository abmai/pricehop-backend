import { describe, expect, test } from "bun:test";

import { createApp } from "../../src/index";
import { MockPageFetcher } from "../../src/services/PageFetcher";
import { MockPriceExtractor } from "../../src/services/PriceExtractor";
import { createInMemoryConvexStore } from "../../convex/store";

const waitForJobCompletion = async (app: ReturnType<typeof createApp>, jobId: string) => {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		const response = await app.request(`http://localhost/prices/status/${jobId}`);
		const body = await response.json();

		if (body.status === "complete" || body.status === "failed") {
			return body;
		}

		await Bun.sleep(10);
	}

	throw new Error(`Timed out waiting for job ${jobId}`);
};

describe("indexing flow", () => {
	test("runs the background worker and serves fresh data after completion", async () => {
		const store = createInMemoryConvexStore();
		const app = createApp({
			store,
			pageFetcher: new MockPageFetcher({
				fallback: (url) => `<html><body><h1>${url}</h1></body></html>`,
			}),
			priceExtractor: new MockPriceExtractor({
				handler: (_html, context) =>
					context.region === "US"
						? {
								productName: "Tiffany T Bracelet",
								sku: "1366369751",
								available: true,
								localPrice: 2200,
								currency: "USD",
								confidence: "high",
							}
						: {
								productName: "Tiffany T Bracelet",
								available: false,
								confidence: "medium",
							},
			}),
		});

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

		const statusBody = await waitForJobCompletion(app, lookupBody.jobId);
		expect(statusBody.status).toBe("complete");

		const refreshedResponse = await app.request("http://localhost/prices/lookup", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				url: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
			}),
		});

		expect(refreshedResponse.status).toBe(200);
		const refreshedBody = await refreshedResponse.json();
		expect(refreshedBody.status).toBe("complete");
		expect(refreshedBody.productName).toBe("Tiffany T Bracelet");
		expect(refreshedBody.prices.some((price: { region: string }) => price.region === "US")).toBe(
			true,
		);
		expect(
			refreshedBody.prices.some(
				(price: { region: string; status?: string }) =>
					price.region === "CA" && price.status === "unavailable",
			),
		).toBe(true);
	});
});
