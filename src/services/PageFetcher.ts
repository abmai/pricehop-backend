import { Context, Effect, Layer } from "effect";
import Steel from "steel-sdk";

import { ScrapingError } from "../domain/errors";
import type { RawPageResult } from "../domain/types";

export interface FetchPageOptions {
	waitSelector?: string;
}

export interface PageFetcherApi {
	fetchPage: (
		url: string,
		options?: FetchPageOptions,
	) => Effect.Effect<RawPageResult, ScrapingError>;
	shutdown: () => Effect.Effect<void>;
}

export const PageFetcher = Context.GenericTag<PageFetcherApi>("pricehop/PageFetcher");

const toScrapingError = (url: string, cause: unknown): ScrapingError =>
	new ScrapingError({
		url,
		cause,
	});

export class HttpPageFetcher implements PageFetcherApi {
	fetchPage(url: string): Effect.Effect<RawPageResult, ScrapingError> {
		return Effect.tryPromise({
			try: async () => {
				const response = await fetch(url, {
					headers: {
						"user-agent":
							"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
					},
				});
				const html = await response.text();

				return {
					url,
					html,
					statusCode: response.status,
					fetchedAt: new Date().toISOString(),
				};
			},
			catch: (cause) => toScrapingError(url, cause),
		});
	}

	shutdown(): Effect.Effect<void> {
		return Effect.void;
	}
}

export class SteelPageFetcher implements PageFetcherApi {
	private readonly client: Steel;

	constructor(
		private readonly apiKey: string,
		private readonly baseURL = Bun.env.STEEL_BASE_URL,
	) {
		this.client = new Steel({
			steelAPIKey: apiKey,
			baseURL,
		});
	}

	fetchPage(url: string): Effect.Effect<RawPageResult, ScrapingError> {
		return Effect.tryPromise({
			try: async () => {
				const response = await this.client.scrape({
					url,
					format: ["html"],
					useProxy: true,
					delay: 1500,
				});

				const html = response.content.html ?? response.content.cleaned_html;
				if (!html) {
					throw new Error("Steel returned no HTML content.");
				}

				return {
					url,
					html,
					statusCode: response.metadata.statusCode,
					fetchedAt: response.metadata.timestamp ?? new Date().toISOString(),
				};
			},
			catch: (cause) => toScrapingError(url, cause),
		});
	}

	shutdown(): Effect.Effect<void> {
		return Effect.void;
	}
}

export interface MockPageFixture {
	html: string;
	statusCode?: number;
}

export interface MockPageFetcherOptions {
	fixtures?: Record<string, string | MockPageFixture>;
	fallback?: (url: string) => string | MockPageFixture;
	onShutdown?: () => void;
}

export class MockPageFetcher implements PageFetcherApi {
	constructor(private readonly options: MockPageFetcherOptions = {}) {}

	fetchPage(url: string): Effect.Effect<RawPageResult, ScrapingError> {
		return Effect.try({
			try: () => {
				const value = this.options.fixtures?.[url] ?? this.options.fallback?.(url);
				if (!value) {
					throw new Error(`No fixture configured for ${url}`);
				}

				const fixture = typeof value === "string" ? { html: value } : value;
				return {
					url,
					html: fixture.html,
					statusCode: fixture.statusCode ?? 200,
					fetchedAt: new Date().toISOString(),
				};
			},
			catch: (cause) => toScrapingError(url, cause),
		});
	}

	shutdown(): Effect.Effect<void> {
		return Effect.sync(() => {
			this.options.onShutdown?.();
		});
	}
}

export const makePageFetcher = (): PageFetcherApi =>
	Bun.env.STEEL_API_KEY ? new SteelPageFetcher(Bun.env.STEEL_API_KEY) : new HttpPageFetcher();

export const PageFetcherLive = Layer.succeed(PageFetcher, makePageFetcher());

export const createPageFetcherLayer = (pageFetcher?: PageFetcherApi) =>
	Layer.succeed(PageFetcher, pageFetcher ?? makePageFetcher());
