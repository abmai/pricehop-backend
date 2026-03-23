import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createAppRuntime } from "../../../src/layers";
import { UrlNormalizer } from "../../../src/services/UrlNormalizer";

describe("UrlNormalizer", () => {
	test("normalizes product URLs by stripping query params, fragments, and trailing slashes", async () => {
		const runtime = createAppRuntime();

		const result = await runtime.runPromise(
			Effect.flatMap(UrlNormalizer, (service) =>
				service.normalize(
					"HTTPS://WWW.TIFFANY.COM/jewelry/bracelets/item-123.html/?utm_source=google&ref=abc#details",
				),
			),
		);

		expect(result).toBe("https://www.tiffany.com/jewelry/bracelets/item-123.html");
	});

	test("returns InvalidUrlError for malformed URLs", async () => {
		const runtime = createAppRuntime();

		const result = await runtime.runPromise(
			Effect.either(Effect.flatMap(UrlNormalizer, (service) => service.normalize("not-a-url"))),
		);

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left._tag).toBe("InvalidUrlError");
		}
	});
});
