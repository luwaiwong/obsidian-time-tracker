<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		children?: Snippet;
		text?: string;
	}

	let { children, text = "" }: Props = $props();
</script>

<p class="text-[10px] text-(--text-faint) uppercase tracking-wider">
	{#if children}
		{@render children()}
	{:else}
		{text}
	{/if}
</p>
