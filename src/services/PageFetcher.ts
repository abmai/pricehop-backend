import { Context, Effect, Layer } from "effect";

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

interface BrightDataResponseEnvelope {
	status_code?: number;
	body?: string;
}

const readBrightDataResponse = async (
	response: Response,
): Promise<Pick<RawPageResult, "html" | "statusCode">> => {
	if (!response.ok) {
		throw new Error(`Bright Data request failed with status ${response.status}.`);
	}

	const contentType = response.headers.get("content-type") ?? "";

	if (contentType.includes("application/json")) {
		const payload = (await response.json()) as BrightDataResponseEnvelope;
		if (!payload.body) {
			throw new Error("Bright Data returned no HTML content.");
		}

		return {
			html: payload.body,
			statusCode: payload.status_code ?? response.status,
		};
	}

	const html = await response.text();
	if (!html) {
		throw new Error("Bright Data returned no HTML content.");
	}

	return {
		html,
		statusCode: response.status,
	};
};

export class BrightDataPageFetcher implements PageFetcherApi {
	constructor(
		private readonly apiKey: string,
		private readonly zone: string,
		private readonly fetchImpl: typeof fetch = fetch,
	) {}

	fetchPage(url: string): Effect.Effect<RawPageResult, ScrapingError> {
		return Effect.tryPromise({
			try: async () => {
				const response = await this.fetchImpl("https://api.brightdata.com/request", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						zone: this.zone,
						url,
						format: "raw",
					}),
				});
				const page = await readBrightDataResponse(response);

				return {
					url,
					html: page.html,
					statusCode: page.statusCode,
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

export const makePageFetcher = (
	env: Record<string, string | undefined> = Bun.env,
	fetchImpl: typeof fetch = fetch,
): PageFetcherApi =>
	env.BRIGHTDATA_API_KEY
		? new BrightDataPageFetcher(
				env.BRIGHTDATA_API_KEY,
				env.BRIGHTDATA_ZONE ?? "web_unlocker1",
				fetchImpl,
			)
		: new HttpPageFetcher();

export const PageFetcherLive = Layer.succeed(PageFetcher, makePageFetcher());

export const createPageFetcherLayer = (pageFetcher?: PageFetcherApi) =>
	Layer.succeed(PageFetcher, pageFetcher ?? makePageFetcher());
