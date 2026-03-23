const STRIP_BLOCK_TAGS = ["script", "style", "svg", "noscript"];
const STRIP_SELF_CLOSING_TAGS = ["img"];
const DEFAULT_MAX_BYTES = 50_000;

const truncateByBytes = (value: string, maxBytes: number): string => {
	const encoder = new TextEncoder();
	if (encoder.encode(value).length <= maxBytes) {
		return value;
	}

	let low = 0;
	let high = value.length;

	while (low < high) {
		const mid = Math.ceil((low + high) / 2);
		const candidate = value.slice(0, mid);
		if (encoder.encode(candidate).length <= maxBytes) {
			low = mid;
		} else {
			high = mid - 1;
		}
	}

	return value.slice(0, low);
};

export interface CleanHtmlOptions {
	maxBytes?: number;
}

export const cleanHtml = (html: string, options: CleanHtmlOptions = {}): string => {
	const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
	let cleaned = html.replace(/<!--[\s\S]*?-->/gu, " ");

	for (const tag of STRIP_BLOCK_TAGS) {
		cleaned = cleaned.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "giu"), " ");
	}

	for (const tag of STRIP_SELF_CLOSING_TAGS) {
		cleaned = cleaned.replace(new RegExp(`<${tag}\\b[^>]*>`, "giu"), " ");
	}

	cleaned = cleaned.replace(/>\s+</gu, "><").replace(/\s+/gu, " ").trim();

	return truncateByBytes(cleaned, maxBytes);
};
