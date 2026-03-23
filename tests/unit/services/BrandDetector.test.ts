import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createAppRuntime } from "../../../src/layers";
import { BrandDetector } from "../../../src/services/BrandDetector";

describe("BrandDetector", () => {
	test("detects a supported brand from the normalized hostname", async () => {
		const runtime = createAppRuntime();

		const result = await runtime.runPromise(
			Effect.flatMap(BrandDetector, (service) =>
				service.detect("https://www.cartier.com/en-us/jewelry/bracelets/item-123"),
			),
		);

		expect(result).toBe("cartier");
	});

	test("returns UnsupportedBrandError for unknown hostnames", async () => {
		const runtime = createAppRuntime();

		const result = await runtime.runPromise(
			Effect.either(
				Effect.flatMap(BrandDetector, (service) =>
					service.detect("https://example.com/products/123"),
				),
			),
		);

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left._tag).toBe("UnsupportedBrandError");
		}
	});
});
