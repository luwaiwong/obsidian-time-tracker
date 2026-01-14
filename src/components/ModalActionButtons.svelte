<script lang="ts">
	interface ButtonConfig {
		text: string;
		onClick: () => void;
		variant?: 'cta' | 'warning' | 'default';
	}

	interface Props {
		primaryButton: ButtonConfig;
		cancelButton?: { text?: string; onClick: () => void };
		leftButtons?: ButtonConfig[];
	}

	let {
		primaryButton,
		cancelButton,
		leftButtons = [],
	}: Props = $props();

	function getButtonClass(variant?: string): string {
		if (variant === 'cta') return 'mod-cta';
		if (variant === 'warning') return 'mod-warning';
		return '';
	}

	function handleClick(e: Event, callback: () => void) {
		e.preventDefault();
		e.stopPropagation();
		callback();
	}
</script>

<div
	style="display: flex !important; flex-direction: row !important; gap: 8px; margin-top: 20px; justify-content: {leftButtons.length > 0 ? 'space-between' : 'flex-end'};"
>
	{#if leftButtons.length > 0}
		<div style="display: flex; gap: 8px;">
			{#each leftButtons as btn}
				<button
					type="button"
					class={getButtonClass(btn.variant)}
					onclick={(e) => handleClick(e, btn.onClick)}
				>
					{btn.text}
				</button>
			{/each}
		</div>
	{/if}

	<div style="display: flex; gap: 8px;">
		{#if cancelButton}
			<button
				type="button"
				onclick={(e) => handleClick(e, cancelButton!.onClick)}
			>
				{cancelButton?.text ?? 'Cancel'}
			</button>
		{/if}
		<button
			type="button"
			class={getButtonClass(primaryButton.variant)}
			onclick={(e) => handleClick(e, primaryButton.onClick)}
		>
			{primaryButton.text}
		</button>
	</div>
</div>
