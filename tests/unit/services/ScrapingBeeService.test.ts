import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import {
	ScrapingBeePageExtractor,
	MockScrapingBeeService,
} from "../../../src/services/ScrapingBeeService";

describe("ScrapingBeeService", () => {
	describe("extractProduct", () => {
		test("constructs the correct URL with query params including ai_extract_rules", async () => {
			let capturedUrl = "";
			const fetcher = new ScrapingBeePageExtractor(
				"test-api-key",
				(async (input: RequestInfo | URL) => {
					capturedUrl = String(input);
					return new Response(
						JSON.stringify({
							name: "Test Product",
							price: "$100.00",
							currency: "USD",
							skus: "SKU123",
							country_code: "US",
							available: true,
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					);
				}) as typeof fetch,
			);

			await Effect.runPromise(fetcher.extractProduct("https://example.com/product"));

			expect(capturedUrl).toContain("app.scrapingbee.com/api/v1");
			expect(capturedUrl).toContain("api_key=test-api-key");
			expect(capturedUrl).toContain("render_js=false");
			expect(capturedUrl).toContain("ai_extract_rules=");
			expect(capturedUrl).toContain("name+of+item");
		});

		test("parses all fields from the response including available boolean", async () => {
			const fetcher = new ScrapingBeePageExtractor(
				"key",
				(async () =>
					new Response(
						JSON.stringify({
							name: "Tiffany T Bracelet",
							price: "$2,200.00",
							currency: "USD",
							skus: "1366369751, 33263503",
							country_code: "us",
							available: "true",
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					)) as typeof fetch,
			);

			const result = await Effect.runPromise(
				fetcher.extractProduct("https://example.com/product"),
			);

			expect(result.name).toBe("Tiffany T Bracelet");
			expect(result.price).toBe("$2,200.00");
			expect(result.currency).toBe("USD");
			expect(result.skus).toBe("1366369751, 33263503");
			expect(result.countryCode).toBe("US");
			expect(result.available).toBe(true);
		});

		test("returns ScrapingError on API failure", async () => {
			const fetcher = new ScrapingBeePageExtractor(
				"key",
				(async () => new Response("error", { status: 500 })) as typeof fetch,
			);

			const result = await Effect.runPromise(
				Effect.either(fetcher.extractProduct("https://example.com/fail")),
			);

			expect(result._tag).toBe("Left");
			if (result._tag === "Left") {
				expect(result.left._tag).toBe("ScrapingError");
			}
		});
	});

	describe("searchProduct", () => {
		test("returns the first URL from search results", async () => {
			const fetcher = new ScrapingBeePageExtractor(
				"key",
				(async () =>
					new Response(
						JSON.stringify({
							results: [
								{ url: "https://example.com/first" },
								{ url: "https://example.com/second" },
							],
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					)) as typeof fetch,
			);

			const result = await Effect.runPromise(
				fetcher.searchProduct("test query", "us"),
			);

			expect(result).toBe("https://example.com/first");
		});

		test("returns null for empty search results", async () => {
			const fetcher = new ScrapingBeePageExtractor(
				"key",
				(async () =>
					new Response(JSON.stringify({ results: [] }), {
						status: 200,
						headers: { "content-type": "application/json" },
					})) as typeof fetch,
			);

			const result = await Effect.runPromise(
				fetcher.searchProduct("test query", "us"),
			);

			expect(result).toBeNull();
		});

		test("propagates ScrapingError on API failure", async () => {
			const fetcher = new ScrapingBeePageExtractor(
				"key",
				(async () => new Response("error", { status: 500 })) as typeof fetch,
			);

			const result = await Effect.runPromise(
				Effect.either(fetcher.searchProduct("test query", "us")),
			);

			expect(result._tag).toBe("Left");
			if (result._tag === "Left") {
				expect(result.left._tag).toBe("ScrapingError");
			}
		});
	});

	describe("MockScrapingBeeService", () => {
		test("returns extract fixture for matching URL", async () => {
			const mock = new MockScrapingBeeService({
				extractFixtures: {
					"https://example.com/product": {
						name: "Test",
						price: "$100",
						countryCode: "US",
						available: true,
					},
				},
			});

			const result = await Effect.runPromise(
				mock.extractProduct("https://example.com/product"),
			);

			expect(result.name).toBe("Test");
		});

		test("returns search fixture for matching query:countryCode key", async () => {
			const mock = new MockScrapingBeeService({
				searchFixtures: {
					"test query:us": "https://example.com/found",
				},
			});

			const result = await Effect.runPromise(mock.searchProduct("test query", "us"));

			expect(result).toBe("https://example.com/found");
		});
	});
});
