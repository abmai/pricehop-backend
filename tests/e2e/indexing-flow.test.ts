import { describe, expect, test } from "bun:test";

import { createApp } from "../../src/index";
import { MockScrapingBeeService } from "../../src/services/ScrapingBeeService";
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
			scrapingBeeService: new MockScrapingBeeService({
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
						available: false,
					},
				},
				searchFallback: (_query, countryCode) => {
					if (countryCode === "ca") {
						return "https://www.tiffany.ca/jewelry/bracelets/item-123.html";
					}
					return null;
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
