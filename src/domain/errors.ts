import { Data } from "effect";

export class InvalidUrlError extends Data.TaggedError("InvalidUrlError")<{
	readonly rawUrl: string;
}> {}

export class UnsupportedBrandError extends Data.TaggedError("UnsupportedBrandError")<{
	readonly hostname: string;
}> {}

export class ProductNotFoundError extends Data.TaggedError("ProductNotFoundError")<{
	readonly normalizedUrl: string;
}> {}

export class IndexingInProgressError extends Data.TaggedError("IndexingInProgressError")<{
	readonly productId: string;
	readonly jobId: string;
}> {}

export class ExchangeRateError extends Data.TaggedError("ExchangeRateError")<{
	readonly currency: string;
}> {}

export class CacheError extends Data.TaggedError("CacheError")<{
	readonly operation: string;
	readonly cause: unknown;
}> {}
