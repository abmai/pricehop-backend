import { Context, Effect, Layer } from "effect";

import { ScrapingError } from "../domain/errors";

export interface ScrapingBeeExtractedData {
	name: string;
	price?: string;
	currency?: string;
	skus?: string;
	countryCode: string;
	available: boolean;
}

export interface ScrapingBeeServiceApi {
	extractProduct: (url: string) => Effect.Effect<ScrapingBeeExtractedData, ScrapingError>;
	searchProduct: (
		query: string,
		countryCode: string,
	) => Effect.Effect<string | null, ScrapingError>;
}

export const ScrapingBeeService =
	Context.GenericTag<ScrapingBeeServiceApi>("pricehop/ScrapingBeeService");

const AI_EXTRACT_RULES = JSON.stringify({
	name: "name of item",
	price: "price of item",
	currency: "ISO 4217 currency code of the price, e.g. USD, AUD, KRW",
	skus: "skus of product",
	country_code:
		"ISO 3166-1 alpha-2 country code of the product website, e.g. US, AU, KR",
	available: "is the product available for purchase, true or false",
});

const toBoolean = (value: unknown): boolean => {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") return value.toLowerCase() === "true";
	return false;
};

const toOptionalString = (value: unknown): string | undefined => {
	if (typeof value === "string" && value.trim()) return value.trim();
	return undefined;
};

const toUpperString = (value: unknown): string | undefined => {
	const s = toOptionalString(value);
	return s ? s.toUpperCase() : undefined;
};

export class ScrapingBeePageExtractor implements ScrapingBeeServiceApi {
	constructor(
		private readonly apiKey: string,
		private readonly fetchImpl: typeof fetch = fetch,
	) {}

	extractProduct(url: string): Effect.Effect<ScrapingBeeExtractedData, ScrapingError> {
		return Effect.tryPromise({
			try: async () => {
				const params = new URLSearchParams({
					api_key: this.apiKey,
					url,
					render_js: "false",
					ai_extract_rules: AI_EXTRACT_RULES,
				});

				const response = await this.fetchImpl(
					`https://app.scrapingbee.com/api/v1?${params.toString()}`,
				);

				if (!response.ok) {
					throw new Error(
						`ScrapingBee extraction failed with status ${response.status}`,
					);
				}

				const data = await response.json();

				const name = toOptionalString(data.name);
				if (!name) {
					throw new Error("ScrapingBee extraction returned no product name");
				}

				const countryCode = toUpperString(data.country_code);
				if (!countryCode) {
					throw new Error("ScrapingBee extraction returned no country code");
				}

				return {
					name,
					price: toOptionalString(data.price),
					currency: toUpperString(data.currency),
					skus: toOptionalString(data.skus),
					countryCode,
					available: toBoolean(data.available),
				};
			},
			catch: (cause) =>
				new ScrapingError({
					url,
					cause,
				}),
		});
	}

	searchProduct(
		query: string,
		countryCode: string,
	): Effect.Effect<string | null, ScrapingError> {
		return Effect.tryPromise({
			try: async () => {
				const params = new URLSearchParams({
					api_key: this.apiKey,
					search: query,
					country_code: countryCode.toLowerCase(),
				});

				const response = await this.fetchImpl(
					`https://app.scrapingbee.com/api/v1/fast_search?${params.toString()}`,
				);

				if (!response.ok) {
					throw new Error(
						`ScrapingBee search failed with status ${response.status}`,
					);
				}

				const data = await response.json();

				if (Array.isArray(data) && data.length > 0 && typeof data[0]?.url === "string") {
					return data[0].url as string;
				}

				if (
					data &&
					typeof data === "object" &&
					Array.isArray(data.results) &&
					data.results.length > 0
				) {
					const firstResult = data.results[0];
					if (typeof firstResult === "string") return firstResult;
					if (typeof firstResult?.url === "string") return firstResult.url;
					if (typeof firstResult?.link === "string") return firstResult.link;
				}

				return null;
			},
			catch: (cause) =>
				new ScrapingError({
					url: `fast_search:${query}`,
					cause,
				}),
		});
	}
}

export interface MockScrapingBeeOptions {
	extractFixtures?: Record<string, ScrapingBeeExtractedData>;
	searchFixtures?: Record<string, string | null>;
	extractFallback?: (url: string) => ScrapingBeeExtractedData;
	searchFallback?: (query: string, countryCode: string) => string | null;
}

export class MockScrapingBeeService implements ScrapingBeeServiceApi {
	constructor(private readonly options: MockScrapingBeeOptions = {}) {}

	extractProduct(url: string): Effect.Effect<ScrapingBeeExtractedData, ScrapingError> {
		return Effect.try({
			try: () => {
				const fixture = this.options.extractFixtures?.[url] ?? this.options.extractFallback?.(url);
				if (!fixture) {
					throw new Error(`No ScrapingBee extract fixture for ${url}`);
				}
				return fixture;
			},
			catch: (cause) => new ScrapingError({ url, cause }),
		});
	}

	searchProduct(
		query: string,
		countryCode: string,
	): Effect.Effect<string | null, ScrapingError> {
		return Effect.try({
			try: () => {
				const key = `${query}:${countryCode}`;
				if (this.options.searchFixtures && key in this.options.searchFixtures) {
					return this.options.searchFixtures[key];
				}
				if (this.options.searchFallback) {
					return this.options.searchFallback(query, countryCode);
				}
				return null;
			},
			catch: (cause) => new ScrapingError({ url: `fast_search:${query}`, cause }),
		});
	}
}

const readConfiguredValue = (value: string | undefined) => {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
};

export const makeScrapingBeeService = (
	env: Record<string, string | undefined> = Bun.env,
	fetchImpl: typeof fetch = fetch,
): ScrapingBeeServiceApi => {
	const apiKey = readConfiguredValue(env.SCRAPINGBEE_API_KEY);
	if (!apiKey) {
		throw new Error("SCRAPINGBEE_API_KEY is required");
	}
	return new ScrapingBeePageExtractor(apiKey, fetchImpl);
};

export const createScrapingBeeServiceLayer = (service?: ScrapingBeeServiceApi) => {
	if (service) {
		return Layer.succeed(ScrapingBeeService, service);
	}

	const apiKey = readConfiguredValue(Bun.env.SCRAPINGBEE_API_KEY);
	if (!apiKey) {
		return Layer.succeed(
			ScrapingBeeService,
			new MockScrapingBeeService(),
		);
	}

	return Layer.succeed(ScrapingBeeService, new ScrapingBeePageExtractor(apiKey));
};
