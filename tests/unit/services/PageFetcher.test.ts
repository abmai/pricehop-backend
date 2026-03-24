import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import {
	BrightDataPageFetcher,
	HttpPageFetcher,
	makePageFetcher,
} from "../../../src/services/PageFetcher";

describe("PageFetcher", () => {
	test("posts to Bright Data and maps JSON envelope responses", async () => {
		const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
		const fetcher = new BrightDataPageFetcher("api-key", "unlocker-zone", (async (input, init) => {
			requests.push({ input, init });

			return new Response(
				JSON.stringify({
					status_code: 206,
					body: "<html><body>priced</body></html>",
				}),
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}) as typeof fetch);

		const result = await Effect.runPromise(fetcher.fetchPage("https://example.com/product"));

		expect(requests).toHaveLength(1);
		expect(requests[0]?.input).toBe("https://api.brightdata.com/request");
		expect(requests[0]?.init?.method).toBe("POST");
		expect(requests[0]?.init?.headers).toEqual({
			Authorization: "Bearer api-key",
			"Content-Type": "application/json",
		});
		expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
			zone: "unlocker-zone",
			url: "https://example.com/product",
			format: "raw",
		});
		expect(result.url).toBe("https://example.com/product");
		expect(result.html).toBe("<html><body>priced</body></html>");
		expect(result.statusCode).toBe(206);
		expect(Number.isNaN(Date.parse(result.fetchedAt))).toBe(false);
	});

	test("uses the default Bright Data zone when only the API key is configured", async () => {
		let requestBody: Record<string, string> | undefined;
		const fetcher = makePageFetcher(
			{
				BRIGHTDATA_API_KEY: "api-key",
			},
			(async (_input, init) => {
				requestBody = JSON.parse(String(init?.body));

				return new Response("<html><body>default-zone</body></html>", {
					status: 200,
					headers: {
						"content-type": "text/html",
					},
				});
			}) as typeof fetch,
		);

		expect(fetcher).toBeInstanceOf(BrightDataPageFetcher);

		const result = await Effect.runPromise(fetcher.fetchPage("https://example.com/default-zone"));

		expect(requestBody).toEqual({
			zone: "web_unlocker1",
			url: "https://example.com/default-zone",
			format: "raw",
		});
		expect(result.statusCode).toBe(200);
		expect(result.html).toBe("<html><body>default-zone</body></html>");
	});

	test("returns a ScrapingError when Bright Data rejects the request", async () => {
		const fetcher = new BrightDataPageFetcher(
			"bad-api-key",
			"unlocker-zone",
			(async () =>
				new Response(JSON.stringify({ error: "unauthorized" }), {
					status: 401,
					headers: {
						"content-type": "application/json",
					},
				})) as unknown as typeof fetch,
		);

		const result = await Effect.runPromise(
			Effect.either(fetcher.fetchPage("https://example.com/rejected")),
		);

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left._tag).toBe("ScrapingError");
			expect(result.left.url).toBe("https://example.com/rejected");
		}
	});

	test("falls back to direct HTTP fetching when Bright Data is not configured", () => {
		const fetcher = makePageFetcher({});

		expect(fetcher).toBeInstanceOf(HttpPageFetcher);
	});
});
