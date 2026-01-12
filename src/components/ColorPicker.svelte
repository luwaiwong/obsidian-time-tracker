<script lang="ts">
	import { PRESET_COLORS } from "../utils/colorUtils";

	interface Props {
		value: string;
		onChange: (color: string) => void;
	}

	const HEX_COLOR_REGEX = /^#([0-9a-f]{6})$/i;

let { value, onChange }: Props = $props();
let textValue = $state("");

	$effect(() => {
		textValue = value;
	});

	const normalizeHex = (input: string): string | null => {
		const trimmed = input.trim();
		if (!trimmed) return null;
		const prefixed = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
		return HEX_COLOR_REGEX.test(prefixed) ? prefixed.toLowerCase() : null;
	};

	const handleTextInput = (raw: string) => {
		textValue = raw;
		const normalized = normalizeHex(raw);
		if (normalized) {
			textValue = normalized;
			if (normalized !== value) {
				onChange(normalized);
			}
		}
	};

	const handleTextBlur = () => {
		textValue = normalizeHex(textValue) ?? value;
	};
</script>

<div class="flex flex-col gap-2">
	<div class="grid grid-cols-5 gap-1.5">
		{#each PRESET_COLORS as presetColor}
			<button
				type="button"
				class="w-full aspect-square rounded-md cursor-pointer transition-all duration-150 hover:scale-110 border-2 {value ===
				presetColor
					? 'border-[--text-normal] ring-2 ring-[--background-primary]'
					: 'border-transparent'}"
				style="background-color: {presetColor};"
				onclick={() => onChange(presetColor)}
				aria-label="Select color {presetColor}"
			></button>
		{/each}
	</div>

	<div class="flex items-center gap-2 pt-1">
		<input
			type="color"
			class="flex-1 h-8 p-0 border border-[--background-modifier-border] rounded cursor-pointer"
			{value}
			oninput={(e) => onChange(e.currentTarget.value)}
			aria-label="Custom color picker"
		/>
		<input
			type="text"
			class="text-xs border border-transparent outline-none cursor-text select-all w-18"
			value={textValue}
			oninput={(e) => handleTextInput(e.currentTarget.value)}
			onclick={(e) => e.currentTarget.select()}
			onblur={handleTextBlur}
			autocomplete="off"
			spellcheck={false}
			aria-label="Color value"
		/>
	</div>
</div>
