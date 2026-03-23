import type { Brand } from "../src/domain/brands";
import type { Region } from "../src/domain/regions";

import type { BrandRecord, BrandUrlRecord } from "./schema";
import type { InMemoryConvexStore } from "./store";

const BRANDS: ReadonlyArray<Pick<BrandRecord, "name" | "baseHost">> = [
	{
		name: "tiffany",
		baseHost: "tiffany.com",
	},
	{
		name: "bottega-veneta",
		baseHost: "bottegaveneta.com",
	},
	{
		name: "cartier",
		baseHost: "cartier.com",
	},
	{
		name: "on",
		baseHost: "on.com",
	},
];

const LOCALE_PREFIXES: Record<Region, string> = {
	AU: "/en-au",
	CA: "/en-ca",
	CN: "/zh-cn",
	HK: "/en-hk",
	KR: "/ko-kr",
	PH: "/en-ph",
	SG: "/en-sg",
	TH: "/en-th",
	TW: "/zh-tw",
	US: "/en-us",
};

const nextSeedBrandId = (store: InMemoryConvexStore): string => {
	store.counters.brand += 1;
	return `brand_${store.counters.brand.toString().padStart(4, "0")}`;
};

const nextSeedBrandUrlId = (store: InMemoryConvexStore): string => {
	store.counters.brandUrl += 1;
	return `brand_url_${store.counters.brandUrl.toString().padStart(4, "0")}`;
};

const buildLocaleEntries = (brandId: string, baseUrl: string): Array<Omit<BrandUrlRecord, "id">> =>
	Object.entries(LOCALE_PREFIXES).map(([region, localePrefix]) => ({
		brandId,
		region,
		baseUrl,
		urlTransform: "locale-prefix",
		localePrefix,
	}));

export const seedBrandData = (store: InMemoryConvexStore): void => {
	if (store.brands.length > 0 || store.brandUrls.length > 0) {
		return;
	}

	const brandIds = new Map<Brand, string>();

	for (const brand of BRANDS) {
		const record: BrandRecord = {
			id: nextSeedBrandId(store),
			name: brand.name,
			baseHost: brand.baseHost,
		};

		store.brands.push(record);
		brandIds.set(record.name, record.id);
	}

	const brandUrls: Array<Omit<BrandUrlRecord, "id">> = [
		{
			brandId: brandIds.get("tiffany")!,
			region: "US",
			baseUrl: "https://www.tiffany.com",
			urlTransform: "path-preserve",
		},
		{
			brandId: brandIds.get("tiffany")!,
			region: "CA",
			baseUrl: "https://www.tiffany.ca",
			urlTransform: "path-preserve",
		},
		{
			brandId: brandIds.get("tiffany")!,
			region: "CN",
			baseUrl: "https://www.tiffany.cn",
			urlTransform: "path-preserve",
		},
		{
			brandId: brandIds.get("tiffany")!,
			region: "HK",
			baseUrl: "https://www.tiffany.com.hk",
			urlTransform: "path-preserve",
		},
		{
			brandId: brandIds.get("tiffany")!,
			region: "KR",
			baseUrl: "https://www.tiffany.co.kr",
			urlTransform: "path-preserve",
		},
		{
			brandId: brandIds.get("tiffany")!,
			region: "PH",
			baseUrl: "https://www.tiffany.com.ph",
			urlTransform: "path-preserve",
		},
		{
			brandId: brandIds.get("tiffany")!,
			region: "SG",
			baseUrl: "https://www.tiffany.com.sg",
			urlTransform: "path-preserve",
		},
		{
			brandId: brandIds.get("tiffany")!,
			region: "TH",
			baseUrl: "https://www.tiffany.co.th",
			urlTransform: "path-preserve",
		},
		{
			brandId: brandIds.get("tiffany")!,
			region: "TW",
			baseUrl: "https://www.tiffany.com.tw",
			urlTransform: "path-preserve",
		},
		{
			brandId: brandIds.get("tiffany")!,
			region: "AU",
			baseUrl: "https://www.tiffany.com.au",
			urlTransform: "path-preserve",
		},
		...buildLocaleEntries(brandIds.get("bottega-veneta")!, "https://www.bottegaveneta.com"),
		...buildLocaleEntries(brandIds.get("cartier")!, "https://www.cartier.com"),
		...buildLocaleEntries(brandIds.get("on")!, "https://www.on.com"),
	];

	for (const brandUrl of brandUrls) {
		store.brandUrls.push({
			id: nextSeedBrandUrlId(store),
			...brandUrl,
		});
	}
};
