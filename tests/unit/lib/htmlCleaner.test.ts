import { describe, expect, test } from "bun:test";

import { cleanHtml } from "../../../src/lib/htmlCleaner";

describe("htmlCleaner", () => {
	test("strips noisy tags and comments", () => {
		const input = `
			<html>
				<head>
					<style>.hidden { display:none; }</style>
					<script>console.log("noise")</script>
				</head>
				<body>
					<!-- comment -->
					<svg><path /></svg>
					<img src="/image.jpg" alt="ignored" />
					<noscript>fallback</noscript>
					<div> Useful content </div>
				</body>
			</html>
		`;

		const cleaned = cleanHtml(input);

		expect(cleaned).toContain("Useful content");
		expect(cleaned).not.toContain("console.log");
		expect(cleaned).not.toContain("comment");
		expect(cleaned).not.toContain("<svg");
		expect(cleaned).not.toContain("<img");
		expect(cleaned).not.toContain("<noscript");
	});

	test("truncates the result to the requested byte length", () => {
		const cleaned = cleanHtml(`<div>${"x".repeat(10_000)}</div>`, {
			maxBytes: 200,
		});

		expect(new TextEncoder().encode(cleaned).length).toBeLessThanOrEqual(200);
	});
});
