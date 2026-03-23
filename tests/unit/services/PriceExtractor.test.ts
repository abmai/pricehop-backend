import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { RuleBasedPriceExtractor } from "../../../src/services/PriceExtractor";

const fixture = await Bun.file(new URL("../../fixtures/tiffany-us.html", import.meta.url)).text();

describe("PriceExtractor", () => {
	test("extracts structured price data from the Tiffany fixture", async () => {
		const extractor = new RuleBasedPriceExtractor();
		const result = await Effect.runPromise(
			extractor.extract(fixture, {
				url: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
				brand: "tiffany",
				region: "US",
				expectedCurrency: "USD",
			}),
		);

		expect(result.productName).toBe("Tiffany T 18k Yellow Gold Bracelet");
		expect(result.sku).toBe("1366369751");
		expect(result.localPrice).toBe(2200);
		expect(result.currency).toBe("USD");
		expect(result.available).toBe(true);
		expect(result.confidence).toBe("high");
	});

	test("marks sold out pages as unavailable", async () => {
		const extractor = new RuleBasedPriceExtractor();
		const outcome = await Effect.runPromise(
			extractor.extract("<html><body><h1>Bracelet</h1><p>Sold out</p></body></html>", {
				url: "https://www.tiffany.com/jewelry/bracelets/item-123.html",
				brand: "tiffany",
				region: "US",
				expectedCurrency: "USD",
			}),
		);

		expect(outcome.available).toBe(false);
		expect(outcome.productName).toBe("Bracelet");
	});
});
