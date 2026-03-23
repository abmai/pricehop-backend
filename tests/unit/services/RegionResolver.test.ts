import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { makeInMemoryConvexClient } from "../../../src/lib/convexEffect";
import { makeRegionResolver } from "../../../src/services/RegionResolver";

const createResolver = () => makeRegionResolver(makeInMemoryConvexClient());

describe("RegionResolver", () => {
	test("preserves the path for Tiffany regional domains", async () => {
		const resolver = createResolver();
		const result = await Effect.runPromise(
			resolver.resolve("https://www.tiffany.com/jewelry/bracelets/item-123.html", "tiffany", "KR"),
		);

		expect(result).toBe("https://www.tiffany.co.kr/jewelry/bracelets/item-123.html");
	});

	test("replaces locale prefixes for same-host brands", async () => {
		const resolver = createResolver();
		const result = await Effect.runPromise(
			resolver.resolve("https://www.cartier.com/en-us/jewelry/item-123", "cartier", "CA"),
		);

		expect(result).toBe("https://www.cartier.com/en-ca/jewelry/item-123");
	});

	test("fails when a region mapping does not exist", async () => {
		const resolver = createResolver();
		const outcome = await Effect.runPromise(
			Effect.either(
				resolver.resolve(
					"https://www.tiffany.com/jewelry/bracelets/item-123.html",
					"tiffany",
					"EU" as never,
				),
			),
		);

		expect(outcome._tag).toBe("Left");
	});
});
