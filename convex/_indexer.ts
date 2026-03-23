export interface IndexingActionInput {
	normalizedUrl: string;
	brand: string;
	regions: string[];
}

export const queueIndexingAction = (_input: IndexingActionInput) => ({
	queued: false,
	reason: "Indexing implementation is deferred in this iteration.",
});
