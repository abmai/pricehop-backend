import type { Brand } from "./brands";

export interface BrandConfig {
	brand: Brand;
	baseHost: string;
}

export const BRAND_REGISTRY: readonly BrandConfig[] = [
	{
		brand: "tiffany",
		baseHost: "tiffany.com",
	},
	{
		brand: "bottega-veneta",
		baseHost: "bottegaveneta.com",
	},
	{
		brand: "cartier",
		baseHost: "cartier.com",
	},
	{
		brand: "on",
		baseHost: "on.com",
	},
] as const;

export const getBrandConfig = (brand: Brand): BrandConfig | undefined =>
	BRAND_REGISTRY.find((entry) => entry.brand === brand);
