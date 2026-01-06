export const PRESET_COLORS = sortColorsByHue([
	"#FF6B6B", // Coral Red
	"#E57373", // Light Red
	"#FFB74D", // Orange
	"#FFA07A", // Light Salmon
	"#F8B88B", // Peach
	"#F7DC6F", // Yellow
	"#81C784", // Light Green
	"#52B788", // Green
	"#98D8C8", // Mint
	"#4DB6AC", // Teal Light
	"#4ECDC4", // Teal
	"#45B7D1", // Sky Blue
	"#85C1E2", // Light Blue
	"#64B5F6", // Blue
	"#9575CD", // Deep Purple
	"#BB8FCE", // Purple
]);

export function getRandomPresetColor(): string {
	return PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
}

/**
 * convert hex color to HSL
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
	// Remove # if present
	hex = hex.replace(/^#/, "");

	// Parse hex values
	const r = parseInt(hex.slice(0, 2), 16) / 255;
	const g = parseInt(hex.slice(2, 4), 16) / 255;
	const b = parseInt(hex.slice(4, 6), 16) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;

	let h = 0;
	let s = 0;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

		switch (max) {
			case r:
				h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
				break;
			case g:
				h = ((b - r) / d + 2) / 6;
				break;
			case b:
				h = ((r - g) / d + 4) / 6;
				break;
		}
	}

	return {
		h: Math.round(h * 360),
		s: Math.round(s * 100),
		l: Math.round(l * 100),
	};
}

/**
 * sort an array of hex colors by hue
 */
export function sortColorsByHue(colors: string[]): string[] {
	return [...colors].sort((a, b) => {
		return compareColors(a, b);
	});
}

export function compareColors(a: string, b: string): number {
	const hslA = hexToHsl(a);
	const hslB = hexToHsl(b);
	return hslA.h - hslB.h;
}
