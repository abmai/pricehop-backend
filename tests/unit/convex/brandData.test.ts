import { describe, expect, test } from "bun:test";

import { createBrand, getAllBrands, getBrandByName } from "../../../convex/brands";
import {
	createBrandUrl,
	getBrandUrlByBrandIdAndRegion,
	getBrandUrlsByBrandId,
} from "../../../convex/brandUrls";
import { createInMemoryConvexStore } from "../../../convex/store";

describe("brand query helpers", () => {
	test("creates and fetches brands by name", () => {
		const store = createInMemoryConvexStore();
		const brand = createBrand(store, {
			name: "acme",
			baseHost: "acme.example",
		});

		expect(getBrandByName(store, "acme")).toEqual(brand);
		expect(getAllBrands(store)).toContainEqual(brand);
	});

	test("creates and fetches brand URLs by brand and region", () => {
		const store = createInMemoryConvexStore();
		const brand = createBrand(store, {
			name: "acme",
			baseHost: "acme.example",
		});

		const brandUrl = createBrandUrl(store, {
			brandId: brand.id,
			region: "US",
			baseUrl: "https://www.acme.example",
			urlTransform: "path-preserve",
			searchPattern: "https://www.acme.example/search?q={query}",
		});

		expect(getBrandUrlByBrandIdAndRegion(store, brand.id, "US")).toEqual(brandUrl);
		expect(getBrandUrlsByBrandId(store, brand.id)).toContainEqual(brandUrl);
	});
});
