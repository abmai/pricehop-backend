import { Effect } from "effect";

import { BrandDetector } from "../services/BrandDetector";
import { IndexingJobService } from "../services/IndexingJobService";
import { PriceLookup, isFresh } from "../services/PriceLookup";
import { UrlNormalizer } from "../services/UrlNormalizer";

export const priceLookup = (rawUrl: string) =>
	Effect.gen(function* () {
		const normalizer = yield* UrlNormalizer;
		const detector = yield* BrandDetector;
		const lookup = yield* PriceLookup;
		const jobs = yield* IndexingJobService;

		const normalizedUrl = yield* normalizer.normalize(rawUrl);
		const brand = yield* detector.detect(normalizedUrl);
		const result = yield* lookup.getByUrl(normalizedUrl);

		if (result && isFresh(result.fetchedAt)) {
			return {
				status: "complete",
				productUrl: normalizedUrl,
				brand,
				productName: result.productName,
				prices: result.prices,
				fetchedAt: result.fetchedAt,
			};
		}

		const job = yield* jobs.createOrGet({
			normalizedUrl,
			rawUrl,
			brand,
		});

		return {
			status: "indexing",
			jobId: job.id,
			productUrl: normalizedUrl,
			brand,
			prices: result?.prices ?? [],
			message: "Price lookup in progress",
		};
	});
