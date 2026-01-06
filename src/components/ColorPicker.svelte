<script lang="ts">
	import { PRESET_COLORS } from "../utils/colorUtils";

	interface Props {
		value: string;
		onChange: (color: string) => void;
	}

	let { value, onChange }: Props = $props();
</script>

<div class="flex flex-col gap-2">
	<div class="grid grid-cols-8 gap-1.5">
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
		<span class="text-xs text-[--text-muted] font-mono shrink-0"
			>{value}</span
		>
	</div>
</div>
