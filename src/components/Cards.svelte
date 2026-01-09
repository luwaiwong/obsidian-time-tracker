<script lang="ts">
	import { formatNaturalDuration } from "../utils/timeUtils";

	interface CardData {
		label: string;
		value: number | Date;
		isDate?: boolean; // if true, live count from that date to now
	}

	interface Props {
		cards: CardData[];
	}

	let { cards }: Props = $props();

	let now = $state(Date.now());

	$effect(() => {
		const hasDate = cards.some((c) => c.isDate);
		if (!hasDate) return;

		const interval = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => clearInterval(interval);
	});

	function getValue(card: CardData): string {
		if (card.isDate && card.value instanceof Date) {
			return formatNaturalDuration(now - card.value.getTime());
		}
		if (typeof card.value === "number") {
			return formatNaturalDuration(card.value);
		}
		return String(card.value);
	}
</script>

{#if cards.length > 0}
	<div class="flex gap-1">
		{#each cards as card (card.label)}
			<div
				class="flex-1 py-1.5 px-2 rounded-lg bg-(--background-secondary) text-center"
			>
				<div
					class="text-[10px] text-(--text-faint) uppercase tracking-wider mb-1"
				>
					{card.label}
				</div>
				<div class="text-sm text-(--text-normal) font-medium tabular-nums">
					{getValue(card)}
				</div>
			</div>
		{/each}
	</div>
{/if}
