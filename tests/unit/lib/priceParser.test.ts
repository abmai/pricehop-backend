import { describe, expect, test } from "bun:test";

import { parsePriceNumber } from "../../../src/lib/priceParser";

describe("parsePriceNumber", () => {
	test("parses plain numbers", () => {
		expect(parsePriceNumber("500")).toBe(500);
		expect(parsePriceNumber("0")).toBe(0);
		expect(parsePriceNumber("99.99")).toBe(99.99);
	});

	test("parses numbers with comma-as-thousands separator", () => {
		expect(parsePriceNumber("1,200")).toBe(1200);
		expect(parsePriceNumber("150,000")).toBe(150000);
		expect(parsePriceNumber("1,200,000")).toBe(1200000);
	});

	test("parses numbers with both comma thousands and dot decimal", () => {
		expect(parsePriceNumber("1,200.00")).toBe(1200);
		expect(parsePriceNumber("1,200.50")).toBe(1200.5);
	});

	test("parses comma as decimal separator for non-thousands patterns", () => {
		expect(parsePriceNumber("1,50")).toBe(1.5);
	});

	test("strips dollar sign currency symbols", () => {
		expect(parsePriceNumber("$1,200")).toBe(1200);
		expect(parsePriceNumber("$500")).toBe(500);
		expect(parsePriceNumber("US$2,200.00")).toBe(2200);
		expect(parsePriceNumber("C$3,050.00")).toBe(3050);
		expect(parsePriceNumber("A$1,800")).toBe(1800);
		expect(parsePriceNumber("HK$15,000")).toBe(15000);
		expect(parsePriceNumber("S$2,000")).toBe(2000);
		expect(parsePriceNumber("NT$65,000")).toBe(65000);
	});

	test("strips yen/yuan currency symbols", () => {
		expect(parsePriceNumber("¥150,000")).toBe(150000);
		expect(parsePriceNumber("CN¥8,500")).toBe(8500);
	});

	test("strips other currency symbols", () => {
		expect(parsePriceNumber("₩1,500,000")).toBe(1500000);
		expect(parsePriceNumber("₱120,000")).toBe(120000);
		expect(parsePriceNumber("฿65,000")).toBe(65000);
		expect(parsePriceNumber("€1,200")).toBe(1200);
	});

	test("handles number type input", () => {
		expect(parsePriceNumber(1200)).toBe(1200);
		expect(parsePriceNumber(0)).toBe(0);
	});

	test("returns undefined for invalid input", () => {
		expect(parsePriceNumber(undefined)).toBeUndefined();
		expect(parsePriceNumber("")).toBeUndefined();
		expect(parsePriceNumber("abc")).toBeUndefined();
		expect(parsePriceNumber(Number.NaN)).toBeUndefined();
		expect(parsePriceNumber(Number.POSITIVE_INFINITY)).toBeUndefined();
	});
});
