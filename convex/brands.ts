import type { BrandRecord } from "./schema";
import { nextBrandId, type InMemoryConvexStore } from "./store";

export interface CreateBrandInput {
	name: string;
	baseHost: string;
}

export const getAllBrands = (store: InMemoryConvexStore): BrandRecord[] => [...store.brands];

export const getBrandByName = (store: InMemoryConvexStore, name: string): BrandRecord | undefined =>
	store.brands.find((brand) => brand.name === name);

export const createBrand = (store: InMemoryConvexStore, input: CreateBrandInput): BrandRecord => {
	const brand: BrandRecord = {
		id: nextBrandId(store),
		name: input.name,
		baseHost: input.baseHost,
	};

	store.brands.push(brand);
	return brand;
};
