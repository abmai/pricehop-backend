import { describe, expect, test } from "bun:test";

import { getAllBrands } from "../../../convex/brands";
import { getAllBrandUrls } from "../../../convex/brandUrls";
import { createInMemoryConvexStore } from "../../../convex/store";
import { ALL_SUPPORTED_REGIONS } from "../../../src/domain/regions";

describe("seedBrandData", () => {
	test("covers every supported region for every seeded brand", () => {
		const store = createInMemoryConvexStore();
		const brands = getAllBrands(store);
		const brandUrls = getAllBrandUrls(store);

		expect(brands).toHaveLength(4);
		expect(brandUrls).toHaveLength(40);

		for (const brand of brands) {
			const regions = brandUrls
				.filter((entry) => entry.brandId === brand.id)
				.map((entry) => entry.region);

			expect(new Set(regions)).toEqual(new Set(ALL_SUPPORTED_REGIONS));
		}
	});

	test("keeps transform-specific fields aligned with the seeded mapping strategy", () => {
		const store = createInMemoryConvexStore();
		const brandUrls = getAllBrandUrls(store);
		const localeEntries = brandUrls.filter((entry) => entry.urlTransform === "locale-prefix");
		const pathPreserveEntries = brandUrls.filter((entry) => entry.urlTransform === "path-preserve");

		expect(localeEntries.length).toBeGreaterThan(0);
		expect(localeEntries.every((entry) => entry.localePrefix?.startsWith("/"))).toBe(true);
		expect(pathPreserveEntries.every((entry) => entry.localePrefix === undefined)).toBe(true);
		expect(brandUrls.every((entry) => entry.searchPattern === undefined)).toBe(true);
	});
});
