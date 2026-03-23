import { Context, Effect, Layer } from "effect";

import { InvalidUrlError } from "../domain/errors";

export interface UrlNormalizerService {
	normalize: (rawUrl: string) => Effect.Effect<string, InvalidUrlError>;
}

export const UrlNormalizer = Context.GenericTag<UrlNormalizerService>("pricehop/UrlNormalizer");

const trimTrailingSlashes = (pathname: string): string => {
	if (pathname === "/") {
		return pathname;
	}

	const trimmed = pathname.replace(/\/+$/u, "");
	return trimmed === "" ? "/" : trimmed;
};

export const makeUrlNormalizer = (): UrlNormalizerService => ({
	normalize: (rawUrl) =>
		Effect.try({
			try: () => {
				const url = new URL(rawUrl);
				url.hostname = url.hostname.toLowerCase();
				url.search = "";
				url.hash = "";
				url.pathname = trimTrailingSlashes(url.pathname);
				return url.toString();
			},
			catch: () =>
				new InvalidUrlError({
					rawUrl,
				}),
		}),
});

export const UrlNormalizerLive = Layer.succeed(UrlNormalizer, makeUrlNormalizer());
