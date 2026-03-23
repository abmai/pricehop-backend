import { describe, expect, test } from "bun:test";

import { SUPPORTED_BRANDS } from "../../../src/domain/brands";
import { REGIONAL_SITES } from "../../../src/domain/regionalSites";
import { ALL_SUPPORTED_REGIONS } from "../../../src/domain/regions";

describe("regionalSites", () => {
	test("covers every supported region for every supported brand", () => {
		for (const brand of SUPPORTED_BRANDS) {
			const regions = REGIONAL_SITES.filter((entry) => entry.brand === brand).map(
				(entry) => entry.region,
			);

			expect(new Set(regions)).toEqual(new Set(ALL_SUPPORTED_REGIONS));
		}
	});

	test("uses locale prefixes only when configured", () => {
		const localeEntries = REGIONAL_SITES.filter((entry) => entry.urlTransform === "locale-prefix");
		expect(localeEntries.length).toBeGreaterThan(0);
		expect(localeEntries.every((entry) => entry.localePrefix?.startsWith("/"))).toBe(true);
	});
});
