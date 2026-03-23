import { Effect, Schema } from "effect";
import { Hono } from "hono";

import { LookupRequestSchema } from "../domain/types";
import { runJsonEffect } from "../lib/effectHono";
import { priceLookup } from "../pipeline/priceLookup";
import { IndexingJobService } from "../services/IndexingJobService";

type RuntimeRunner = {
	runPromise: (effect: Effect.Effect<any, any, any>) => Promise<any>;
};

export const createPricesRouter = (runtime: RuntimeRunner) => {
	const router = new Hono();

	router.post("/lookup", async (context) => {
		const payload = await context.req.json().catch(() => null);
		const decoded = Schema.decodeUnknownEither(LookupRequestSchema)(payload);

		if (decoded._tag === "Left") {
			context.status(400);
			return context.json({
				error: "InvalidUrlError",
				message: "Request body must contain a string url field.",
			});
		}

		return runJsonEffect(context, runtime, priceLookup(decoded.right.url), (body) =>
			context.json(body, body.status === "indexing" ? 202 : 200),
		);
	});

	router.get("/status/:jobId", async (context) =>
		runJsonEffect(
			context,
			runtime,
			Effect.flatMap(IndexingJobService, (service) =>
				service.getStatus(context.req.param("jobId")),
			),
			(job) =>
				job
					? context.json(job, 200)
					: ((context.status(404),
						context.json({
							error: "NotFound",
							message: "Indexing job was not found.",
						})) as Response),
		),
	);

	return router;
};
