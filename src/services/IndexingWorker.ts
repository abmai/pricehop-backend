import { Context, Effect, Layer } from "effect";

import { ProductNotFoundError } from "../domain/errors";
import { REGION_TO_CURRENCY } from "../domain/regions";
import { CurrencyConverter } from "./CurrencyConverter";
import type { CurrencyConverterApi } from "./CurrencyConverter";
import { PageFetcher } from "./PageFetcher";
import type { PageFetcherApi } from "./PageFetcher";
import { PriceExtractor } from "./PriceExtractor";
import type { PriceExtractorApi } from "./PriceExtractor";
import { RegionResolver } from "./RegionResolver";
import type { RegionResolverApi } from "./RegionResolver";
import { ConvexClient, type ConvexClientService } from "../lib/convexEffect";

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

export const makeIndexingWorker = (
	convex: ConvexClientService,
	resolver: RegionResolverApi,
	fetcher: PageFetcherApi,
	extractor: PriceExtractorApi,
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

			const results = yield* Effect.forEach(
				job.regions,
				(region) =>
					Effect.either(
						Effect.gen(function* () {
							const expectedCurrency = REGION_TO_CURRENCY[region];
							const regionalUrl = yield* resolver.resolve(
								product.normalizedUrl,
								product.brand,
								region,
							);
							const page = yield* fetcher.fetchPage(regionalUrl);

							if (page.statusCode >= 400) {
								return yield* Effect.fail(
									new Error(`Regional fetch returned status ${page.statusCode}`),
								);
							}

							const extracted = yield* extractor.extract(page.html, {
								url: regionalUrl,
								brand: product.brand,
								region,
								expectedCurrency,
							});

							if (!extracted.available || extracted.localPrice === undefined) {
								yield* convex.upsertPrices(product.id, [
									{
										region,
										status: "unavailable",
										confidence: extracted.confidence,
										fetchedAt: page.fetchedAt,
									},
								]);

								return {
									region,
									productName: extracted.productName,
									available: false,
								};
							}

							const currency = extracted.currency ?? expectedCurrency;
							const converted = yield* converter.toUsd(extracted.localPrice, currency);

							yield* convex.upsertPrices(product.id, [
								{
									region,
									currency,
									localPrice: extracted.localPrice,
									usdPrice: converted.usdPrice,
									exchangeRate: converted.exchangeRate,
									confidence: extracted.confidence,
									fetchedAt: page.fetchedAt,
								},
							]);

							return {
								region,
								productName: extracted.productName,
								available: true,
							};
						}),
					),
				{ concurrency: 3 },
			).pipe(Effect.ensuring(fetcher.shutdown()));

			const successes = results
				.filter(
					(result): result is Extract<typeof result, { _tag: "Right" }> => result._tag === "Right",
				)
				.map((result) => result.right);
			const failures = results
				.filter(
					(result): result is Extract<typeof result, { _tag: "Left" }> => result._tag === "Left",
				)
				.map((result) => formatError(result.left));

			const productName = successes.find((result) => result.productName)?.productName;
			if (productName) {
				yield* convex.updateProductName(product.id, productName);
			}

			yield* convex.updateIndexingJobStatus(jobId, successes.length > 0 ? "complete" : "failed", {
				error: failures.length > 0 ? failures.join("; ") : undefined,
				completedAt: new Date().toISOString(),
			});

			if (successes.length === 0 && failures.length > 0) {
				return yield* Effect.fail(new Error(failures.join("; ")));
			}
		}),
});

export const IndexingWorkerLive = Layer.effect(
	IndexingWorker,
	Effect.gen(function* () {
		const convex = yield* ConvexClient;
		const resolver = yield* RegionResolver;
		const fetcher = yield* PageFetcher;
		const extractor = yield* PriceExtractor;
		const converter = yield* CurrencyConverter;

		return makeIndexingWorker(convex, resolver, fetcher, extractor, converter);
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
