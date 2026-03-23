import { Effect } from "effect";
import type { Context as HonoContext } from "hono";
import type { StatusCode } from "hono/utils/http-status";

type RuntimeRunner = {
	runPromise: (effect: Effect.Effect<any, any, any>) => Promise<any>;
};

const getHttpStatus = (tag: string): StatusCode => {
	switch (tag) {
		case "InvalidUrlError":
		case "UnsupportedBrandError":
			return 400;
		case "ProductNotFoundError":
			return 404;
		case "ExchangeRateError":
			return 502;
		case "CacheError":
		default:
			return 500;
	}
};

export const runJsonEffect = async <A, E extends { _tag: string; message?: string }, R>(
	context: HonoContext,
	runtime: RuntimeRunner,
	effect: Effect.Effect<A, E, R>,
	onSuccess: (value: A) => Response | Promise<Response>,
): Promise<Response> => {
	const outcome = await runtime.runPromise(Effect.either(effect));

	if (outcome._tag === "Left") {
		context.status(getHttpStatus(outcome.left._tag));
		return context.json({
			error: outcome.left._tag,
			message: outcome.left.message ?? outcome.left._tag,
		});
	}

	return onSuccess(outcome.right);
};
