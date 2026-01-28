<script lang="ts">
	interface ButtonConfig {
		text: string;
		onClick: () => void;
		variant?: 'cta' | 'warning' | 'default';
		useAwaitClickCallback?: boolean;
	}

	interface Props {
		rightButtons?: ButtonConfig[];
		leftButtons?: ButtonConfig[];
	}

	let {
		rightButtons = [],
		leftButtons = [],
	}: Props = $props();

	function getButtonClass(variant?: string): string {
		if (variant === 'cta') return 'mod-cta';
		if (variant === 'warning') return 'mod-warning';
		return '';
	}

	let buttonStates = $state<Record<string, boolean>>({
		saving: false,
	});

	async function handleClick(e: Event, btn: ButtonConfig) {
		e.preventDefault();
		e.stopPropagation();
		
		// direct call if not using await callback
		if (btn.useAwaitClickCallback ) {
			btn.onClick();
			return;
		}

		// await callback and use saving state
		if (buttonStates.saving) return;
		buttonStates[btn.text] = true;
		try {
			await btn.onClick();
		} finally {
			buttonStates[btn.text] = false;
		}
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
					disabled={!btn.useAwaitClickCallback && buttonStates[btn.text]}
					onclick={(e) => handleClick(e, btn)}
				>
					{#if !btn.useAwaitClickCallback && buttonStates[btn.text]}
						<span class="loading-spinner" style="display: inline-block; width: 12px; height: 12px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></span>
					{:else}
						{btn.text}
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	<div style="display: flex; gap: 8px;">
		{#each rightButtons as btn}
			<button
				type="button"
				class={getButtonClass(btn.variant)}
				disabled={!btn.useAwaitClickCallback && buttonStates[btn.text]}
				onclick={(e) => handleClick(e, btn)}
			>
				{#if !btn.useAwaitClickCallback && buttonStates[btn.text]}
					<span class="loading-spinner" style="display: inline-block; width: 12px; height: 12px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></span>
				{:else}
					{btn.text}
				{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
