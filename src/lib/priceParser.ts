const CURRENCY_SYMBOL_PATTERN =
	/^(?:US\$|A\$|C\$|HK\$|S\$|NT\$|CN¥|[$¥€₩₱฿])\s*/u;

const CURRENCY_SUFFIX_PATTERN = /\s*(?:USD|AUD|CAD|CNY|HKD|KRW|PHP|SGD|THB|TWD)$/iu;

const stripCurrencySymbols = (value: string): string =>
	value.replace(CURRENCY_SYMBOL_PATTERN, "").replace(CURRENCY_SUFFIX_PATTERN, "").trim();

export const parsePriceNumber = (value: string | number | undefined): number | undefined => {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : undefined;
	}

	if (!value) {
		return undefined;
	}

	const stripped = stripCurrencySymbols(value);
	const normalized = stripped.replace(/[^\d.,-]/gu, "").trim();

	if (!normalized) {
		return undefined;
	}

	const hasComma = normalized.includes(",");
	const hasDot = normalized.includes(".");
	let candidate = normalized;

	if (hasComma && hasDot) {
		candidate = normalized.replace(/,/gu, "");
	} else if (hasComma && !hasDot) {
		if (/,\d{3}(?:,\d{3})*$/u.test(normalized)) {
			candidate = normalized.replace(/,/gu, "");
		} else {
			candidate = normalized.replace(/,/gu, ".");
		}
	}

	const parsed = Number(candidate);
	return Number.isFinite(parsed) ? parsed : undefined;
};
