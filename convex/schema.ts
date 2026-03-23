import type { Brand } from "../src/domain/brands";
import type { CurrencyCode, Region } from "../src/domain/regions";
import type { IndexingJobStatus, PriceConfidence } from "../src/domain/types";

export interface ProductRecord {
	id: string;
	normalizedUrl: string;
	brand: Brand;
	productName?: string;
	rawUrl: string;
	createdAt: string;
}

export interface StoredAvailablePriceRecord {
	productId: string;
	region: Region;
	status?: "available";
	currency: CurrencyCode;
	localPrice: number;
	usdPrice: number;
	exchangeRate: number;
	confidence: PriceConfidence;
	fetchedAt: string;
}

export interface StoredUnavailablePriceRecord {
	productId: string;
	region: Region;
	status: "unavailable";
	confidence: PriceConfidence;
	fetchedAt: string;
}

export type StoredPriceRecord = StoredAvailablePriceRecord | StoredUnavailablePriceRecord;

export interface IndexingJobRecord {
	id: string;
	productId: string;
	status: IndexingJobStatus;
	regions: Region[];
	error?: string;
	createdAt: string;
	completedAt?: string;
}

export interface ExchangeRateRecord {
	currency: CurrencyCode;
	rateToUsd: number;
	fetchedAt: string;
}
