<script lang="ts">
	let {
		value = $bindable(""),
		placeholder = "",
		rows = 3,
		style = "",
		disabled = false,
		onInput,
	}: {
		value?: string;
		placeholder?: string;
		rows?: number;
		style?: string;
		disabled?: boolean;
		onInput?: (value: string) => void;
	} = $props();

	function handleInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		value = target.value;
		onInput?.(target.value);
	}
</script>

<textarea
	class="text-area-component"
	{value}
	{placeholder}
	{rows}
	{disabled}
	{style}
	oninput={handleInput}
></textarea>

<style>
	.text-area-component {
		width: 100%;
		background: var(--background-modifier-form-field);
		border: 1px solid var(--background-modifier-border);
		color: var(--text-normal);
		padding: 8px 12px;
		border-radius: 4px;
		font-size: 14px;
		font-family: var(--font-interface);
		resize: vertical;
	}

	.text-area-component:focus {
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 2px var(--background-modifier-border-focus);
		outline: none;
	}
</style>
