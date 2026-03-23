import { Hono } from "hono";

import type { InMemoryConvexStore } from "../convex/store";
import { createAppRuntime } from "./layers";
import { createPricesRouter } from "./routes/prices";

export interface CreateAppOptions {
	store?: InMemoryConvexStore;
}

export const createApp = (options: CreateAppOptions = {}) => {
	const runtime = createAppRuntime(options);
	const app = new Hono();

	app.get("/", (context) =>
		context.json({
			status: "ok",
		}),
	);

	app.route("/prices", createPricesRouter(runtime));

	return app;
};

if (import.meta.main) {
	const app = createApp();
	const port = Number(Bun.env.PORT ?? "3000");

	Bun.serve({
		port,
		fetch: app.fetch,
	});

	console.log(`PriceHop backend listening on http://localhost:${port}`);
}
