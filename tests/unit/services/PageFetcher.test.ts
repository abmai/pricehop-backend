import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { HttpPageFetcher, MockPageFetcher, makePageFetcher } from "../../../src/services/PageFetcher";

describe("PageFetcher", () => {
	test("makePageFetcher returns an HttpPageFetcher", () => {
		const fetcher = makePageFetcher();
		expect(fetcher).toBeInstanceOf(HttpPageFetcher);
	});

	test("MockPageFetcher returns fixture data for a known URL", async () => {
		const fetcher = new MockPageFetcher({
			fixtures: {
				"https://example.com/product": "<html><body>product page</body></html>",
			},
		});

		const result = await Effect.runPromise(fetcher.fetchPage("https://example.com/product"));

		expect(result.url).toBe("https://example.com/product");
		expect(result.html).toBe("<html><body>product page</body></html>");
		expect(result.statusCode).toBe(200);
	});

	test("MockPageFetcher calls fallback for unknown URLs", async () => {
		const fetcher = new MockPageFetcher({
			fallback: (url) => `<html>${url}</html>`,
		});

		const result = await Effect.runPromise(fetcher.fetchPage("https://example.com/unknown"));

		expect(result.html).toBe("<html>https://example.com/unknown</html>");
	});

	test("MockPageFetcher returns ScrapingError for unconfigured URLs", async () => {
		const fetcher = new MockPageFetcher();

		const result = await Effect.runPromise(
			Effect.either(fetcher.fetchPage("https://example.com/missing")),
		);

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left._tag).toBe("ScrapingError");
		}
	});
});
