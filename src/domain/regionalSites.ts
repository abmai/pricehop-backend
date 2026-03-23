import type { Brand } from "./brands";
import type { Region } from "./regions";

export type RegionalUrlTransform = "path-preserve" | "locale-prefix";

export interface RegionalSiteEntry {
	brand: Brand;
	region: Region;
	baseUrl: string;
	urlTransform: RegionalUrlTransform;
	localePrefix?: string;
}

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

const buildLocaleEntries = (brand: Brand, baseUrl: string): RegionalSiteEntry[] =>
	Object.entries(LOCALE_PREFIXES).map(([region, localePrefix]) => ({
		brand,
		region: region as Region,
		baseUrl,
		urlTransform: "locale-prefix",
		localePrefix,
	}));

export const REGIONAL_SITES: readonly RegionalSiteEntry[] = [
	{
		brand: "tiffany",
		region: "US",
		baseUrl: "https://www.tiffany.com",
		urlTransform: "path-preserve",
	},
	{
		brand: "tiffany",
		region: "CA",
		baseUrl: "https://www.tiffany.ca",
		urlTransform: "path-preserve",
	},
	{
		brand: "tiffany",
		region: "CN",
		baseUrl: "https://www.tiffany.cn",
		urlTransform: "path-preserve",
	},
	{
		brand: "tiffany",
		region: "HK",
		baseUrl: "https://www.tiffany.com.hk",
		urlTransform: "path-preserve",
	},
	{
		brand: "tiffany",
		region: "KR",
		baseUrl: "https://www.tiffany.co.kr",
		urlTransform: "path-preserve",
	},
	{
		brand: "tiffany",
		region: "PH",
		baseUrl: "https://www.tiffany.com.ph",
		urlTransform: "path-preserve",
	},
	{
		brand: "tiffany",
		region: "SG",
		baseUrl: "https://www.tiffany.com.sg",
		urlTransform: "path-preserve",
	},
	{
		brand: "tiffany",
		region: "TH",
		baseUrl: "https://www.tiffany.co.th",
		urlTransform: "path-preserve",
	},
	{
		brand: "tiffany",
		region: "TW",
		baseUrl: "https://www.tiffany.com.tw",
		urlTransform: "path-preserve",
	},
	{
		brand: "tiffany",
		region: "AU",
		baseUrl: "https://www.tiffany.com.au",
		urlTransform: "path-preserve",
	},
	...buildLocaleEntries("bottega-veneta", "https://www.bottegaveneta.com"),
	...buildLocaleEntries("cartier", "https://www.cartier.com"),
	...buildLocaleEntries("on", "https://www.on.com"),
] as const;

export const getRegionalSiteEntry = (brand: Brand, region: Region): RegionalSiteEntry | undefined =>
	REGIONAL_SITES.find((entry) => entry.brand === brand && entry.region === region);
