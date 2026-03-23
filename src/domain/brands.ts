export const SUPPORTED_BRANDS = ["tiffany", "bottega-veneta", "cartier", "on"] as const;

export type Brand = (typeof SUPPORTED_BRANDS)[number];

export const BRAND_HOSTS: Record<Brand, string[]> = {
	tiffany: ["tiffany.com"],
	"bottega-veneta": ["bottegaveneta.com"],
	cartier: ["cartier.com"],
	on: ["on.com"],
};
