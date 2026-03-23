import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import type { Brand } from "../src/domain/brands";
import type { CurrencyCode, Region } from "../src/domain/regions";
import type { IndexingJobStatus, PriceConfidence } from "../src/domain/types";

export type BrandUrlTransform = "path-preserve" | "locale-prefix";

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

export interface BrandRecord {
	id: string;
	name: string;
	baseHost: string;
}

export interface BrandUrlRecord {
	id: string;
	brandId: string;
	region: string;
	baseUrl: string;
	urlTransform: BrandUrlTransform;
	localePrefix?: string;
	searchPattern?: string;
}

const regionValidator = v.union(
	v.literal("AU"),
	v.literal("CA"),
	v.literal("CN"),
	v.literal("HK"),
	v.literal("KR"),
	v.literal("PH"),
	v.literal("SG"),
	v.literal("TH"),
	v.literal("TW"),
	v.literal("US"),
);

const currencyValidator = v.union(
	v.literal("AUD"),
	v.literal("CAD"),
	v.literal("CNY"),
	v.literal("HKD"),
	v.literal("KRW"),
	v.literal("PHP"),
	v.literal("SGD"),
	v.literal("THB"),
	v.literal("TWD"),
	v.literal("USD"),
);

const priceConfidenceValidator = v.union(v.literal("high"), v.literal("medium"), v.literal("low"));

const indexingJobStatusValidator = v.union(
	v.literal("pending"),
	v.literal("running"),
	v.literal("complete"),
	v.literal("failed"),
);

const urlTransformValidator = v.union(v.literal("path-preserve"), v.literal("locale-prefix"));

export default defineSchema({
	products: defineTable({
		normalizedUrl: v.string(),
		brand: v.string(),
		productName: v.optional(v.string()),
		rawUrl: v.string(),
		createdAt: v.string(),
	}).index("by_normalized_url", ["normalizedUrl"]),
	prices: defineTable({
		productId: v.id("products"),
		region: regionValidator,
		status: v.optional(v.union(v.literal("available"), v.literal("unavailable"))),
		currency: v.optional(currencyValidator),
		localPrice: v.optional(v.number()),
		usdPrice: v.optional(v.number()),
		exchangeRate: v.optional(v.number()),
		confidence: priceConfidenceValidator,
		fetchedAt: v.string(),
	})
		.index("by_productId", ["productId"])
		.index("by_productId_region", ["productId", "region"]),
	indexingJobs: defineTable({
		productId: v.id("products"),
		status: indexingJobStatusValidator,
		regions: v.array(regionValidator),
		error: v.optional(v.string()),
		createdAt: v.string(),
		completedAt: v.optional(v.string()),
	})
		.index("by_productId", ["productId"])
		.index("by_status", ["status"]),
	exchangeRates: defineTable({
		currency: currencyValidator,
		rateToUsd: v.number(),
		fetchedAt: v.string(),
	}).index("by_currency", ["currency"]),
	brands: defineTable({
		name: v.string(),
		baseHost: v.string(),
	}).index("by_name", ["name"]),
	brand_urls: defineTable({
		brandId: v.id("brands"),
		region: regionValidator,
		baseUrl: v.string(),
		urlTransform: urlTransformValidator,
		localePrefix: v.optional(v.string()),
		searchPattern: v.optional(v.string()),
	})
		.index("by_brandId", ["brandId"])
		.index("by_brandId_region", ["brandId", "region"]),
});
