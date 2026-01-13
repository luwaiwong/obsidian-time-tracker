<script lang="ts">
	interface Props {
		value: string;
		placeholder?: string;
		style?: string;
		onInput?: (value: string) => void;
		onKeyDown?: (e: KeyboardEvent) => void;
	}

	let {
		value = $bindable(),
		placeholder = "",
		style = "",
		onInput,
		onKeyDown,
	}: Props = $props();

	function handleInput(e: Event) {
		const input = e.target as HTMLInputElement;
		value = input.value;
		onInput?.(input.value);
	}

	function handleKeyDown(e: KeyboardEvent) {
		onKeyDown?.(e);
	}
</script>

<input
	type="text"
	class="w-full px-3 bg-(--background-primary-alt) rounded-lg focus:outline-none focus:border-(--border-primary-focus)"
	{style}
	{value}
	{placeholder}
	oninput={handleInput}
	onkeydown={handleKeyDown}
/>
