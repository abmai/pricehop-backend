export const ALL_SUPPORTED_REGIONS = [
	"AU",
	"CA",
	"CN",
	"HK",
	"KR",
	"PH",
	"SG",
	"TH",
	"TW",
	"US",
] as const;

export type Region = (typeof ALL_SUPPORTED_REGIONS)[number];

export const SUPPORTED_CURRENCIES = [
	"AUD",
	"CAD",
	"CNY",
	"HKD",
	"KRW",
	"PHP",
	"SGD",
	"THB",
	"TWD",
	"USD",
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const REGION_TO_CURRENCY: Record<Region, CurrencyCode> = {
	AU: "AUD",
	CA: "CAD",
	CN: "CNY",
	HK: "HKD",
	KR: "KRW",
	PH: "PHP",
	SG: "SGD",
	TH: "THB",
	TW: "TWD",
	US: "USD",
};
