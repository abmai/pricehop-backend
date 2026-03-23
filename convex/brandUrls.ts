import type { BrandUrlRecord } from "./schema";
import { nextBrandUrlId, type InMemoryConvexStore } from "./store";

export interface CreateBrandUrlInput {
	brandId: string;
	region: string;
	baseUrl: string;
	urlTransform: BrandUrlRecord["urlTransform"];
	localePrefix?: string;
	searchPattern?: string;
}

export const getAllBrandUrls = (store: InMemoryConvexStore): BrandUrlRecord[] => [
	...store.brandUrls,
];

export const getBrandUrlsByBrandId = (
	store: InMemoryConvexStore,
	brandId: string,
): BrandUrlRecord[] => store.brandUrls.filter((brandUrl) => brandUrl.brandId === brandId);

export const getBrandUrlByBrandIdAndRegion = (
	store: InMemoryConvexStore,
	brandId: string,
	region: string,
): BrandUrlRecord | undefined =>
	store.brandUrls.find((brandUrl) => brandUrl.brandId === brandId && brandUrl.region === region);

export const createBrandUrl = (
	store: InMemoryConvexStore,
	input: CreateBrandUrlInput,
): BrandUrlRecord => {
	const brandUrl: BrandUrlRecord = {
		id: nextBrandUrlId(store),
		brandId: input.brandId,
		region: input.region,
		baseUrl: input.baseUrl,
		urlTransform: input.urlTransform,
		localePrefix: input.localePrefix,
		searchPattern: input.searchPattern,
	};

	store.brandUrls.push(brandUrl);
	return brandUrl;
};
