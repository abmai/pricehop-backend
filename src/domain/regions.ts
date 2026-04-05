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

export const COUNTRY_CODE_TO_REGION: Record<string, Region | undefined> = {
	AU: "AU",
	CA: "CA",
	CN: "CN",
	HK: "HK",
	KR: "KR",
	PH: "PH",
	SG: "SG",
	TH: "TH",
	TW: "TW",
	US: "US",
};

export const REGION_TO_COUNTRY_CODE: Record<Region, string> = {
	AU: "au",
	CA: "ca",
	CN: "cn",
	HK: "hk",
	KR: "kr",
	PH: "ph",
	SG: "sg",
	TH: "th",
	TW: "tw",
	US: "us",
};

export const REGION_TO_COUNTRY_NAME: Record<Region, string> = {
	AU: "australian",
	CA: "canadian",
	CN: "chinese",
	HK: "hong kong",
	KR: "korean",
	PH: "philippine",
	SG: "singapore",
	TH: "thai",
	TW: "taiwanese",
	US: "american",
};
