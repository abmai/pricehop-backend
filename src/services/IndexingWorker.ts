import { Context, Effect, Layer } from "effect";

import { ProductNotFoundError } from "../domain/errors";
import {
	COUNTRY_CODE_TO_REGION,
	REGION_TO_COUNTRY_CODE,
	REGION_TO_COUNTRY_NAME,
	REGION_TO_CURRENCY,
	SUPPORTED_CURRENCIES,
	type CurrencyCode,
	type Region,
} from "../domain/regions";
import { CurrencyConverter } from "./CurrencyConverter";
import type { CurrencyConverterApi } from "./CurrencyConverter";
import { ScrapingBeeService } from "./ScrapingBeeService";
import type { ScrapingBeeServiceApi, ScrapingBeeExtractedData } from "./ScrapingBeeService";
import { ConvexClient, type ConvexClientService } from "../lib/convexEffect";
import { parsePriceNumber } from "../lib/priceParser";

export interface IndexingWorkerApi {
	processJob: (jobId: string) => Effect.Effect<void, unknown>;
}

export interface IndexingDispatcherApi {
	dispatch: (jobId: string) => Effect.Effect<void>;
}

export const IndexingWorker = Context.GenericTag<IndexingWorkerApi>("pricehop/IndexingWorker");
export const IndexingDispatcher = Context.GenericTag<IndexingDispatcherApi>(
	"pricehop/IndexingDispatcher",
);

const formatError = (error: unknown): string => {
	if (typeof error === "string") {
		return error;
	}

	if (error && typeof error === "object" && "cause" in error) {
		return formatError(error.cause);
	}

	if (error && typeof error === "object" && "reason" in error && typeof error.reason === "string") {
		return error.reason;
	}

	if (
		error &&
		typeof error === "object" &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return error.message;
	}

	if (error && typeof error === "object" && "_tag" in error && typeof error._tag === "string") {
		return error._tag;
	}

	return "Unknown error";
};

const isSupportedCurrency = (code: string): code is CurrencyCode =>
	(SUPPORTED_CURRENCIES as readonly string[]).includes(code);

const skusOverlap = (a: string, b: string): boolean => {
	const setA = new Set(a.split(/[,\s]+/u).map((s) => s.trim()).filter(Boolean));
	const setB = new Set(b.split(/[,\s]+/u).map((s) => s.trim()).filter(Boolean));
	for (const sku of setA) {
		if (setB.has(sku)) return true;
	}
	return false;
};

export const makeIndexingWorker = (
	convex: ConvexClientService,
	scrapingBee: ScrapingBeeServiceApi,
	converter: CurrencyConverterApi,
): IndexingWorkerApi => ({
	processJob: (jobId) =>
		Effect.gen(function* () {
			const job = yield* convex.getIndexingJobById(jobId);
			if (
				!job ||
				job.status === "running" ||
				job.status === "complete" ||
				job.status === "failed"
			) {
				return;
			}

			const product = yield* convex.getProductById(job.productId);
			if (!product) {
				yield* convex.updateIndexingJobStatus(jobId, "failed", {
					error: `Product ${job.productId} was not found.`,
					completedAt: new Date().toISOString(),
				});

				return yield* Effect.fail(
					new ProductNotFoundError({
						normalizedUrl: job.productId,
					}),
				);
			}

			yield* convex.updateIndexingJobStatus(jobId, "running");

			yield* Effect.catchAll(
				Effect.gen(function* () {
					// Step 4: Extract source product
					const sourceData = yield* scrapingBee.extractProduct(product.normalizedUrl);

					// Step 5: Update product
					yield* convex.updateProduct(product.id, {
						productName: sourceData.name,
						...(sourceData.skus ? { skus: sourceData.skus } : {}),
					});

					// Step 6: Map source country to region
					const sourceRegion =
						COUNTRY_CODE_TO_REGION[sourceData.countryCode.toUpperCase()];

					// Step 7: Source region price write (isolated)
					const sourceResult = yield* processSourceRegion(
						convex,
						converter,
						product.id,
						sourceData,
						sourceRegion,
						job.regions,
					);

					// Step 8: Determine target regions
					const targetRegions = job.regions.filter(
						(region) => region !== sourceRegion,
					);

					// Step 9: Process each target region
					const brandRecord = yield* convex.getBrandByName(product.brand);

					const targetResults = yield* Effect.forEach(
						targetRegions,
						(region) =>
							Effect.either(
								processTargetRegion(
									convex,
									scrapingBee,
									converter,
									product.id,
									sourceData,
									region,
									brandRecord?.id,
								),
							),
						{ concurrency: 3 },
					);

					// Step 10-11: Tally results
					const allResults = [
						...(sourceResult ? [sourceResult] : []),
						...targetResults,
					];

					const successes = allResults.filter(
						(r): r is Extract<typeof r, { _tag: "Right" }> =>
							r._tag === "Right",
					);
					const failures = allResults
						.filter(
							(r): r is Extract<typeof r, { _tag: "Left" }> =>
								r._tag === "Left",
						)
						.map((r) => formatError(r.left));

					yield* convex.updateIndexingJobStatus(
						jobId,
						successes.length > 0 ? "complete" : "failed",
						{
							error:
								failures.length > 0
									? failures.join("; ")
									: undefined,
							completedAt: new Date().toISOString(),
						},
					);

					if (successes.length === 0 && failures.length > 0) {
						return yield* Effect.fail(new Error(failures.join("; ")));
					}
				}),
				(error) =>
					convex
						.updateIndexingJobStatus(jobId, "failed", {
							error: formatError(error),
							completedAt: new Date().toISOString(),
						})
						.pipe(Effect.flatMap(() => Effect.fail(error))),
			);
		}),
});

const processSourceRegion = (
	convex: ConvexClientService,
	converter: CurrencyConverterApi,
	productId: string,
	sourceData: ScrapingBeeExtractedData,
	sourceRegion: Region | undefined,
	jobRegions: readonly Region[],
) => {
	if (!sourceRegion || !jobRegions.includes(sourceRegion)) {
		return Effect.succeed(undefined);
	}

	return Effect.either(
		Effect.gen(function* () {
			const expectedCurrency = REGION_TO_CURRENCY[sourceRegion];

			if (!sourceData.available) {
				yield* convex.upsertPrices(productId, [
					{
						region: sourceRegion,
						status: "unavailable",
						confidence: "high",
						fetchedAt: new Date().toISOString(),
					},
				]);
				return { region: sourceRegion, available: false };
			}

			const localPrice = parsePriceNumber(sourceData.price);
			if (localPrice === undefined) {
				return yield* Effect.fail(
					new Error(`Source price unparseable for ${sourceRegion}`),
				);
			}

			let currency: CurrencyCode;
			let confidence: "high" | "medium" | "low";

			if (sourceData.currency && isSupportedCurrency(sourceData.currency)) {
				currency = sourceData.currency;
				confidence = currency === expectedCurrency ? "high" : "medium";
			} else if (sourceData.currency) {
				return yield* Effect.fail(
					new Error(`Unsupported source currency: ${sourceData.currency}`),
				);
			} else {
				currency = expectedCurrency;
				confidence = "high";
			}

			const converted = yield* converter.toUsd(localPrice, currency);

			yield* convex.upsertPrices(productId, [
				{
					region: sourceRegion,
					currency,
					localPrice,
					usdPrice: converted.usdPrice,
					exchangeRate: converted.exchangeRate,
					confidence,
					fetchedAt: new Date().toISOString(),
				},
			]);

			return { region: sourceRegion, available: true };
		}),
	);
};

const processTargetRegion = (
	convex: ConvexClientService,
	scrapingBee: ScrapingBeeServiceApi,
	converter: CurrencyConverterApi,
	productId: string,
	sourceData: ScrapingBeeExtractedData,
	region: Region,
	brandId: string | undefined,
) =>
	Effect.gen(function* () {
		// Step 9a: Look up allowed hostname
		if (!brandId) {
			return yield* Effect.fail(new Error(`No brand record found`));
		}

		const brandUrl = yield* convex.getBrandUrlByBrandIdAndRegion(brandId, region);
		if (!brandUrl) {
			return yield* Effect.fail(
				new Error(`No brand_urls entry for region ${region}`),
			);
		}

		const expectedHostname = new URL(brandUrl.baseUrl).hostname;

		// Step 9b: Build search query
		const skusPart = sourceData.skus ? ` ${sourceData.skus}` : "";
		const countryName = REGION_TO_COUNTRY_NAME[region];
		const query = `${sourceData.name}${skusPart} ${countryName} price`;

		// Step 9c: Search
		const foundUrl = yield* scrapingBee.searchProduct(
			query,
			REGION_TO_COUNTRY_CODE[region],
		);

		// Step 9d: Empty results
		if (foundUrl === null) {
			return yield* Effect.fail(
				new Error(`No search results for ${region}`),
			);
		}

		// Step 9e: Validate hostname
		const foundHostname = new URL(foundUrl).hostname;
		if (foundHostname !== expectedHostname) {
			return yield* Effect.fail(
				new Error(
					`Hostname mismatch for ${region}: expected ${expectedHostname}, got ${foundHostname}`,
				),
			);
		}

		// Step 9f: Extract from found URL
		const extracted = yield* scrapingBee.extractProduct(foundUrl);

		// Validate country
		const extractedRegion =
			COUNTRY_CODE_TO_REGION[extracted.countryCode.toUpperCase()];
		if (extractedRegion !== region) {
			return yield* Effect.fail(
				new Error(
					`Country mismatch for ${region}: extracted ${extracted.countryCode}`,
				),
			);
		}

		// Validate product identity via SKU overlap
		let skuVerified = false;
		if (sourceData.skus && extracted.skus) {
			if (!skusOverlap(sourceData.skus, extracted.skus)) {
				return yield* Effect.fail(
					new Error(`SKU mismatch for ${region}: wrong product`),
				);
			}
			skuVerified = true;
		}

		const expectedCurrency = REGION_TO_CURRENCY[region];

		// Unavailable
		if (!extracted.available) {
			yield* convex.upsertPrices(productId, [
				{
					region,
					status: "unavailable",
					confidence: "medium",
					fetchedAt: new Date().toISOString(),
				},
			]);
			return { region, available: false };
		}

		// Parse price
		const localPrice = parsePriceNumber(extracted.price);
		if (localPrice === undefined) {
			return yield* Effect.fail(
				new Error(`Price unparseable for ${region}`),
			);
		}

		// Currency resolution
		let currency: CurrencyCode;
		let currencyMatches = true;

		if (extracted.currency && isSupportedCurrency(extracted.currency)) {
			currency = extracted.currency;
			currencyMatches = currency === expectedCurrency;
		} else if (extracted.currency) {
			return yield* Effect.fail(
				new Error(`Unsupported currency for ${region}: ${extracted.currency}`),
			);
		} else {
			currency = expectedCurrency;
		}

		// Confidence
		let confidence: "high" | "medium" | "low" = "medium";
		if (!currencyMatches || !skuVerified) {
			confidence = "low";
		}

		const converted = yield* converter.toUsd(localPrice, currency);

		yield* convex.upsertPrices(productId, [
			{
				region,
				currency,
				localPrice,
				usdPrice: converted.usdPrice,
				exchangeRate: converted.exchangeRate,
				confidence,
				fetchedAt: new Date().toISOString(),
			},
		]);

		return { region, available: true };
	});

export const IndexingWorkerLive = Layer.effect(
	IndexingWorker,
	Effect.gen(function* () {
		const convex = yield* ConvexClient;
		const scrapingBee = yield* ScrapingBeeService;
		const converter = yield* CurrencyConverter;

		return makeIndexingWorker(convex, scrapingBee, converter);
	}),
);

export const makeIndexingDispatcher = (worker: IndexingWorkerApi): IndexingDispatcherApi => ({
	dispatch: (jobId) =>
		Effect.asVoid(Effect.forkDaemon(Effect.catchAll(worker.processJob(jobId), () => Effect.void))),
});

export const IndexingDispatcherLive = Layer.effect(
	IndexingDispatcher,
	Effect.map(IndexingWorker, (worker) => makeIndexingDispatcher(worker)),
);

export const createIndexingDispatcherLayer = (dispatcher: IndexingDispatcherApi) =>
	Layer.succeed(IndexingDispatcher, dispatcher);
