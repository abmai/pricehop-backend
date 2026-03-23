import { Schema } from "effect";

import type { Brand } from "./brands";
import type { CurrencyCode, Region } from "./regions";

export const PriceConfidenceSchema = Schema.Literal("high", "medium", "low");
export type PriceConfidence = Schema.Schema.Type<typeof PriceConfidenceSchema>;

export const IndexingJobStatusSchema = Schema.Literal("pending", "running", "complete", "failed");
export type IndexingJobStatus = Schema.Schema.Type<typeof IndexingJobStatusSchema>;
export type MutableJobStatus = Exclude<IndexingJobStatus, "complete" | "failed">;

export const LookupRequestSchema = Schema.Struct({
	url: Schema.String,
});
export type LookupRequest = Schema.Schema.Type<typeof LookupRequestSchema>;

export interface AvailablePrice {
	region: Region;
	currency: CurrencyCode;
	localPrice: number;
	usdPrice: number;
	exchangeRate: number;
	confidence: PriceConfidence;
}

export interface UnavailablePrice {
	region: Region;
	status: "unavailable";
}

export type PriceEntry = AvailablePrice | UnavailablePrice;

export interface ProductSnapshot {
	productId: string;
	productUrl: string;
	brand: Brand;
	productName?: string;
	prices: PriceEntry[];
	fetchedAt: string;
}

export interface CompleteLookupResponse {
	status: "complete";
	productUrl: string;
	brand: Brand;
	productName?: string;
	prices: PriceEntry[];
	fetchedAt: string;
}

export interface IndexingLookupResponse {
	status: "indexing";
	jobId: string;
	productUrl: string;
	brand: Brand;
	prices: PriceEntry[];
	message: string;
}

export type PriceLookupResponse = CompleteLookupResponse | IndexingLookupResponse;

export interface IndexingJobSnapshot {
	id: string;
	productId: string;
	status: IndexingJobStatus;
	regions: Region[];
	error?: string;
	createdAt: string;
	completedAt?: string;
}
