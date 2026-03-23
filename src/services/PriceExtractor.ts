import { Context, Effect, Layer } from "effect";
import OpenAI from "openai";

import { ExtractionError } from "../domain/errors";
import type { CurrencyCode, Region } from "../domain/regions";
import type { ExtractedPriceData } from "../domain/types";
import { cleanHtml } from "../lib/htmlCleaner";

export interface PriceExtractionContext {
	url: string;
	brand: string;
	region: Region;
	expectedCurrency: CurrencyCode;
}

export interface PriceExtractorApi {
	extract: (
		html: string,
		context: PriceExtractionContext,
	) => Effect.Effect<ExtractedPriceData, ExtractionError>;
}

export const PriceExtractor = Context.GenericTag<PriceExtractorApi>("pricehop/PriceExtractor");

const normalizeWhitespace = (value: string | null | undefined): string | undefined => {
	const normalized = value?.replace(/\s+/gu, " ").trim();
	return normalized ? normalized : undefined;
};

const normalizeProductName = (value: string | null | undefined): string | undefined => {
	const normalized = normalizeWhitespace(value);
	if (!normalized) {
		return undefined;
	}

	return normalized.replace(/\s+\|\s+.*$/u, "").replace(/\s+-\s+.*$/u, "");
};

const parsePriceNumber = (value: string | number | undefined): number | undefined => {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : undefined;
	}

	if (!value) {
		return undefined;
	}

	const normalized = value.replace(/[^\d.,-]/gu, "").trim();
	if (!normalized) {
		return undefined;
	}

	const hasComma = normalized.includes(",");
	const hasDot = normalized.includes(".");
	let candidate = normalized;

	if (hasComma && hasDot) {
		candidate = normalized.replace(/,/gu, "");
	} else if (hasComma && !hasDot) {
		candidate = normalized.replace(/,/gu, ".");
	}

	const parsed = Number(candidate);
	return Number.isFinite(parsed) ? parsed : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [value]);

const findOfferRecord = (value: unknown): Record<string, unknown> | undefined => {
	if (Array.isArray(value)) {
		for (const item of value) {
			const record = findOfferRecord(item);
			if (record) {
				return record;
			}
		}
		return undefined;
	}

	if (!isRecord(value)) {
		return undefined;
	}

	if (isRecord(value.offers)) {
		return value.offers;
	}

	if (Array.isArray(value.offers)) {
		return value.offers.find(isRecord);
	}

	if (Array.isArray(value["@graph"])) {
		for (const item of value["@graph"]) {
			const record = findOfferRecord(item);
			if (record) {
				return record;
			}
		}
	}

	return undefined;
};

const decodeHtmlEntities = (value: string): string =>
	value
		.replace(/&amp;/gu, "&")
		.replace(/&quot;/gu, '"')
		.replace(/&#39;/gu, "'")
		.replace(/&lt;/gu, "<")
		.replace(/&gt;/gu, ">");

const stripTags = (value: string): string => decodeHtmlEntities(value.replace(/<[^>]+>/gu, " "));

const getTagText = (html: string, tagName: string): string | undefined => {
	const match = html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "iu"));
	return normalizeWhitespace(match?.[1] ? stripTags(match[1]) : undefined);
};

const getMetaContent = (
	html: string,
	attribute: "name" | "property",
	value: string,
): string | undefined => {
	const tags = html.match(/<meta\b[^>]*>/giu) ?? [];
	const attributePattern = new RegExp(
		`${attribute}\\s*=\\s*["']${value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}["']`,
		"iu",
	);

	for (const tag of tags) {
		if (!attributePattern.test(tag)) {
			continue;
		}

		const contentMatch = tag.match(/content\s*=\s*["']([^"']+)["']/iu);
		if (contentMatch?.[1]) {
			return normalizeWhitespace(decodeHtmlEntities(contentMatch[1]));
		}
	}

	return undefined;
};

const getJsonLdCandidates = (html: string): Record<string, unknown>[] => {
	const scripts = [
		...html.matchAll(
			/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu,
		),
	];
	const candidates: Record<string, unknown>[] = [];

	for (const script of scripts) {
		const content = script[1]?.trim();
		if (!content) {
			continue;
		}

		try {
			const parsed = JSON.parse(content);
			for (const item of asArray(parsed)) {
				if (isRecord(item)) {
					candidates.push(item);
				}
			}
		} catch {
			continue;
		}
	}

	return candidates;
};

const extractStructuredData = (
	html: string,
	expectedCurrency: CurrencyCode,
): ExtractedPriceData | undefined => {
	const jsonLd = getJsonLdCandidates(html);

	for (const entry of jsonLd) {
		const offer = findOfferRecord(entry);
		const productName = normalizeProductName(
			typeof entry.name === "string" ? entry.name : undefined,
		);
		const sku = normalizeWhitespace(typeof entry.sku === "string" ? entry.sku : undefined);
		const currency = normalizeWhitespace(
			typeof offer?.priceCurrency === "string" ? offer.priceCurrency : undefined,
		) as CurrencyCode | undefined;
		const localPrice = parsePriceNumber(
			typeof offer?.price === "string" || typeof offer?.price === "number"
				? offer.price
				: undefined,
		);
		const availability = normalizeWhitespace(
			typeof offer?.availability === "string" ? offer.availability : undefined,
		);

		if (productName || localPrice !== undefined || availability) {
			const available =
				availability?.toLowerCase().includes("outofstock") ||
				availability?.toLowerCase().includes("soldout")
					? false
					: localPrice !== undefined;

			return {
				productName,
				sku,
				localPrice,
				currency: currency ?? expectedCurrency,
				available,
				confidence: currency === expectedCurrency || currency === undefined ? "high" : "medium",
			};
		}
	}

	return undefined;
};

const extractMetaData = (
	html: string,
	expectedCurrency: CurrencyCode,
): ExtractedPriceData | undefined => {
	const productName = normalizeProductName(
		getMetaContent(html, "property", "og:title") ??
			getMetaContent(html, "name", "twitter:title") ??
			getTagText(html, "h1") ??
			getTagText(html, "title"),
	);
	const sku = normalizeWhitespace(
		getMetaContent(html, "name", "sku") ??
			getMetaContent(html, "property", "product:retailer_item_id"),
	);
	const localPrice = parsePriceNumber(
		getMetaContent(html, "property", "product:price:amount") ??
			getMetaContent(html, "name", "price"),
	);
	const currency = normalizeWhitespace(
		getMetaContent(html, "property", "product:price:currency") ??
			getMetaContent(html, "name", "currency"),
	) as CurrencyCode | undefined;

	if (!productName && localPrice === undefined) {
		return undefined;
	}

	return {
		productName,
		sku,
		localPrice,
		currency: currency ?? expectedCurrency,
		available: localPrice !== undefined,
		confidence: currency === expectedCurrency || currency === undefined ? "high" : "medium",
	};
};

const CURRENCY_SYMBOLS: Record<CurrencyCode, string[]> = {
	AUD: ["A$", "$"],
	CAD: ["C$", "$"],
	CNY: ["CN¥", "¥"],
	HKD: ["HK$", "$"],
	KRW: ["₩", "KRW"],
	PHP: ["₱", "PHP"],
	SGD: ["S$", "$"],
	THB: ["฿", "THB"],
	TWD: ["NT$", "TWD"],
	USD: ["US$", "$"],
};

const extractVisiblePrice = (
	html: string,
	expectedCurrency: CurrencyCode,
): ExtractedPriceData | undefined => {
	const pricePatterns = CURRENCY_SYMBOLS[expectedCurrency]
		.map((symbol) => symbol.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
		.map((escaped) => new RegExp(`${escaped}\\s*([\\d,.]+)`, "u"));

	for (const pattern of pricePatterns) {
		const match = html.match(pattern);
		if (!match?.[1]) {
			continue;
		}

		const localPrice = parsePriceNumber(match[1]);
		if (localPrice === undefined) {
			continue;
		}

		return {
			productName: normalizeProductName(getTagText(html, "h1") ?? getTagText(html, "title")),
			sku:
				normalizeWhitespace(
					html.match(/(?:sku|style|item)\s*(?:#|number|no\.?)?\s*[:#]?\s*([a-z0-9-]+)/iu)?.[1],
				) ?? undefined,
			localPrice,
			currency: expectedCurrency,
			available: true,
			confidence: "medium",
		};
	}

	if (/(sold out|out of stock|unavailable)/iu.test(html)) {
		return {
			productName: normalizeProductName(getTagText(html, "h1") ?? getTagText(html, "title")),
			available: false,
			confidence: "low",
		};
	}

	return undefined;
};

const parseExtractedData = (
	value: unknown,
	context: PriceExtractionContext,
): ExtractedPriceData => {
	if (!isRecord(value) || typeof value.available !== "boolean") {
		throw new ExtractionError({
			url: context.url,
			reason: "Structured model response was not a valid extraction payload.",
			cause: value,
		});
	}

	const confidence =
		value.confidence === "high" || value.confidence === "medium" || value.confidence === "low"
			? value.confidence
			: "low";

	return {
		productName: normalizeProductName(
			typeof value.productName === "string" ? value.productName : undefined,
		),
		sku: normalizeWhitespace(typeof value.sku === "string" ? value.sku : undefined),
		localPrice: parsePriceNumber(
			typeof value.localPrice === "string" || typeof value.localPrice === "number"
				? value.localPrice
				: undefined,
		),
		currency: normalizeWhitespace(
			typeof value.currency === "string" ? value.currency : undefined,
		) as CurrencyCode | undefined,
		available: value.available,
		confidence:
			(value.currency === context.expectedCurrency || value.currency === undefined) &&
			confidence === "low"
				? "medium"
				: confidence,
	};
};

export class RuleBasedPriceExtractor implements PriceExtractorApi {
	extract(
		html: string,
		context: PriceExtractionContext,
	): Effect.Effect<ExtractedPriceData, ExtractionError> {
		return Effect.try({
			try: () => {
				const structured = extractStructuredData(html, context.expectedCurrency);
				const meta = structured ?? extractMetaData(html, context.expectedCurrency);
				const visible = meta ?? extractVisiblePrice(html, context.expectedCurrency);

				if (!visible) {
					throw new ExtractionError({
						url: context.url,
						reason: "Could not extract product data from page HTML.",
					});
				}

				return visible;
			},
			catch: (cause) =>
				cause instanceof ExtractionError
					? cause
					: new ExtractionError({
							url: context.url,
							reason: "Rule-based extraction failed.",
							cause,
						}),
		});
	}
}

export class OpenRouterPriceExtractor implements PriceExtractorApi {
	private readonly client: OpenAI;

	constructor(
		private readonly apiKey: string,
		private readonly baseURL = Bun.env.LLM_BASE_URL ?? "https://openrouter.ai/api/v1",
		private readonly model = Bun.env.LLM_MODEL ?? "google/gemini-2.0-flash-001",
	) {
		this.client = new OpenAI({
			apiKey,
			baseURL,
		});
	}

	extract(
		html: string,
		context: PriceExtractionContext,
	): Effect.Effect<ExtractedPriceData, ExtractionError> {
		return Effect.tryPromise({
			try: async () => {
				const cleanedHtml = cleanHtml(html);
				const response = await this.client.chat.completions.create({
					model: this.model,
					temperature: 0,
					response_format: { type: "json_object" },
					messages: [
						{
							role: "system",
							content:
								"You extract structured product pricing data from ecommerce HTML. Return only JSON.",
						},
						{
							role: "user",
							content: [
								`Brand: ${context.brand}`,
								`Region: ${context.region}`,
								`Expected currency: ${context.expectedCurrency}`,
								"Return a JSON object with:",
								"- productName: string or null",
								"- sku: string or null",
								"- localPrice: number or null",
								"- currency: ISO 4217 currency code or null",
								"- available: boolean",
								'- confidence: "high" | "medium" | "low"',
								"",
								cleanedHtml,
							].join("\n"),
						},
					],
				});
				const content = response.choices[0]?.message?.content;
				if (!content) {
					throw new ExtractionError({
						url: context.url,
						reason: "LLM returned an empty response.",
					});
				}

				return parseExtractedData(JSON.parse(content), context);
			},
			catch: (cause) =>
				cause instanceof ExtractionError
					? cause
					: new ExtractionError({
							url: context.url,
							reason: "LLM extraction failed.",
							cause,
						}),
		});
	}
}

export interface MockPriceExtractorOptions {
	handler?: (html: string, context: PriceExtractionContext) => ExtractedPriceData;
}

export class MockPriceExtractor implements PriceExtractorApi {
	constructor(private readonly options: MockPriceExtractorOptions = {}) {}

	extract(
		html: string,
		context: PriceExtractionContext,
	): Effect.Effect<ExtractedPriceData, ExtractionError> {
		return Effect.try({
			try: () =>
				this.options.handler?.(html, context) ?? {
					productName: `${context.brand} ${context.region} fixture`,
					available: true,
					localPrice: 100,
					currency: context.expectedCurrency,
					confidence: "high",
				},
			catch: (cause) =>
				new ExtractionError({
					url: context.url,
					reason: "Mock extraction failed.",
					cause,
				}),
		});
	}
}

export class FallbackPriceExtractor implements PriceExtractorApi {
	constructor(
		private readonly primary: PriceExtractorApi,
		private readonly fallback: PriceExtractorApi,
	) {}

	extract(
		html: string,
		context: PriceExtractionContext,
	): Effect.Effect<ExtractedPriceData, ExtractionError> {
		return Effect.catchAll(this.primary.extract(html, context), () =>
			this.fallback.extract(html, context),
		);
	}
}

export const makePriceExtractor = (): PriceExtractorApi => {
	const ruleBased = new RuleBasedPriceExtractor();
	return Bun.env.OPENROUTER_API_KEY
		? new FallbackPriceExtractor(
				new OpenRouterPriceExtractor(Bun.env.OPENROUTER_API_KEY),
				ruleBased,
			)
		: ruleBased;
};

export const PriceExtractorLive = Layer.succeed(PriceExtractor, makePriceExtractor());

export const createPriceExtractorLayer = (extractor?: PriceExtractorApi) =>
	Layer.succeed(PriceExtractor, extractor ?? makePriceExtractor());
