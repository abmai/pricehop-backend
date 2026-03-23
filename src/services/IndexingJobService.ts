import { Context, Effect, Layer } from "effect";

import type { Brand } from "../domain/brands";
import { CacheError } from "../domain/errors";
import { ALL_SUPPORTED_REGIONS } from "../domain/regions";
import type { IndexingJobSnapshot } from "../domain/types";
import type { ConvexClientService } from "../lib/convexEffect";

export interface CreateOrGetIndexingJobInput {
	normalizedUrl: string;
	rawUrl: string;
	brand: Brand;
}

export interface IndexingJobServiceApi {
	createOrGet: (
		input: CreateOrGetIndexingJobInput,
	) => Effect.Effect<IndexingJobSnapshot, CacheError>;
	getStatus: (jobId: string) => Effect.Effect<IndexingJobSnapshot | undefined, CacheError>;
}

export const IndexingJobService = Context.GenericTag<IndexingJobServiceApi>(
	"pricehop/IndexingJobService",
);

const toSnapshot = (job: {
	id: string;
	productId: string;
	status: IndexingJobSnapshot["status"];
	regions: IndexingJobSnapshot["regions"];
	error?: string;
	createdAt: string;
	completedAt?: string;
}): IndexingJobSnapshot => ({
	id: job.id,
	productId: job.productId,
	status: job.status,
	regions: [...job.regions],
	error: job.error,
	createdAt: job.createdAt,
	completedAt: job.completedAt,
});

export const makeIndexingJobService = (
	convexClient: ConvexClientService,
): IndexingJobServiceApi => ({
	createOrGet: (input) =>
		Effect.gen(function* () {
			const product = yield* convexClient.getOrCreateProduct({
				normalizedUrl: input.normalizedUrl,
				brand: input.brand,
				rawUrl: input.rawUrl,
			});

			const existingJob = yield* convexClient.findActiveIndexingJobByProductId(product.id);
			if (existingJob) {
				return toSnapshot(existingJob);
			}

			const job = yield* convexClient.createIndexingJob(product.id, [...ALL_SUPPORTED_REGIONS]);
			return toSnapshot(job);
		}),
	getStatus: (jobId) =>
		Effect.map(convexClient.getIndexingJobById(jobId), (job) =>
			job ? toSnapshot(job) : undefined,
		),
});

export const createIndexingJobLayer = (convexClient: ConvexClientService) =>
	Layer.succeed(IndexingJobService, makeIndexingJobService(convexClient));
