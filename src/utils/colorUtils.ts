export const PRESET_COLORS = sortColorsByHue([
	"#23272d", 
	"#4c566a", 
	"#5e81ac", 
	"#81a1c1", 
	"#88c0d0", 
	// "#8fbcbb", 
	"#a3be8c", 
	"#ebcb8b", 
	"#d08770", 
	"#bf616a", 
	"#b48ead", 
	// "#45B7D1", 
	// "#85C1E2", 
	// "#64B5F6", 
	// "#9575CD", 
	// "#BB8FCE", 
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
