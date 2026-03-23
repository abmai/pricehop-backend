import type { Region } from "../src/domain/regions";
import type { IndexingJobStatus, MutableJobStatus } from "../src/domain/types";
import type { IndexingJobRecord } from "./schema";
import { nextJobId, type InMemoryConvexStore } from "./store";

const ACTIVE_JOB_STATUSES: MutableJobStatus[] = ["pending", "running"];

export const getIndexingJobById = (
	store: InMemoryConvexStore,
	id: string,
): IndexingJobRecord | undefined => store.indexingJobs.find((job) => job.id === id);

export const findActiveIndexingJobByProductId = (
	store: InMemoryConvexStore,
	productId: string,
): IndexingJobRecord | undefined =>
	store.indexingJobs.find(
		(job) =>
			job.productId === productId && ACTIVE_JOB_STATUSES.includes(job.status as MutableJobStatus),
	);

export interface CreateIndexingJobInput {
	productId: string;
	regions: Region[];
}

export const createIndexingJob = (
	store: InMemoryConvexStore,
	input: CreateIndexingJobInput,
): IndexingJobRecord => {
	const job: IndexingJobRecord = {
		id: nextJobId(store),
		productId: input.productId,
		status: "pending",
		regions: [...input.regions],
		createdAt: new Date().toISOString(),
	};

	store.indexingJobs.push(job);
	return job;
};

export const updateIndexingJobStatus = (
	store: InMemoryConvexStore,
	id: string,
	status: IndexingJobStatus,
	options?: {
		error?: string;
		completedAt?: string;
	},
): IndexingJobRecord | undefined => {
	const job = getIndexingJobById(store, id);
	if (!job) {
		return undefined;
	}

	job.status = status;
	job.error = options?.error;
	job.completedAt = options?.completedAt;
	return job;
};
