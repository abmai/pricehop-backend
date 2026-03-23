import type { Brand } from "../src/domain/brands";
import type { ProductRecord } from "./schema";
import { nextProductId, type InMemoryConvexStore } from "./store";

export interface CreateProductInput {
	normalizedUrl: string;
	brand: Brand;
	rawUrl: string;
	productName?: string;
}

export const findProductByNormalizedUrl = (
	store: InMemoryConvexStore,
	normalizedUrl: string,
): ProductRecord | undefined =>
	store.products.find((product) => product.normalizedUrl === normalizedUrl);

export const getProductById = (store: InMemoryConvexStore, id: string): ProductRecord | undefined =>
	store.products.find((product) => product.id === id);

export const getOrCreateProduct = (
	store: InMemoryConvexStore,
	input: CreateProductInput,
): ProductRecord => {
	const existing = findProductByNormalizedUrl(store, input.normalizedUrl);
	if (existing) {
		if (!existing.productName && input.productName) {
			existing.productName = input.productName;
		}
		return existing;
	}

	const product: ProductRecord = {
		id: nextProductId(store),
		normalizedUrl: input.normalizedUrl,
		brand: input.brand,
		productName: input.productName,
		rawUrl: input.rawUrl,
		createdAt: new Date().toISOString(),
	};

	store.products.push(product);
	return product;
};

export const updateProductName = (
	store: InMemoryConvexStore,
	id: string,
	productName: string,
): ProductRecord | undefined => {
	const product = getProductById(store, id);
	if (!product) {
		return undefined;
	}

	product.productName = productName;
	return product;
};
