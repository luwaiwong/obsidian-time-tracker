<script lang="ts">
	import { formatNaturalDuration } from "../utils/timeUtils";

	interface Props {
		lastRecordEndTime: Date | null;
		startTime: Date;
		endTime: Date | null;
		isRetroactive: boolean;
	}

	let { lastRecordEndTime, startTime, endTime, isRetroactive }: Props =
		$props();

	let now = $state(Date.now());

	$effect(() => {
		const interval = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => clearInterval(interval);
	});

	let sinceLastRecord = $derived(
		lastRecordEndTime ? now - lastRecordEndTime.getTime() : null,
	);

	let recordDuration = $derived(
		isRetroactive && endTime
			? endTime.getTime() - startTime.getTime()
			: null,
	);

	let afterRecord = $derived(
		isRetroactive && endTime ? now - endTime.getTime() : null,
	);
</script>

<div class="flex gap-1">
	{#if sinceLastRecord !== null}
		<div
			class="flex-1 py-1.5 px-2 rounded-lg bg-(--background-secondary) text-center"
		>
			<div
				class="text-[10px] text-(--text-faint) uppercase tracking-wider mb-1"
			>
				Time Since Last
			</div>
			<div class="text-sm text-(--text-normal) font-medium tabular-nums">
				{formatNaturalDuration(sinceLastRecord)}
			</div>
		</div>
	{/if}

	{#if recordDuration !== null && !isRetroactive}
		<div
			class="flex-1 py-1.5 px-2 rounded-lg bg-(--background-secondary) text-center"
		>
			<div
				class="text-[10px] text-(--text-faint) uppercase tracking-wider mb-1"
			>
				Record Duration
			</div>
			<div class="text-sm text-(--text-normal) font-medium tabular-nums">
				{formatNaturalDuration(recordDuration)}
			</div>
		</div>
	{/if}

	{#if afterRecord !== null}
		<div
			class="flex-1 py-1.5 px-2 rounded-lg bg-(--background-secondary) text-center"
		>
			<div
				class="text-[10px] text-(--text-faint) uppercase tracking-wider mb-1"
			>
				Time Remaining
			</div>
			<div class="text-sm text-(--text-normal) font-medium tabular-nums">
				{formatNaturalDuration(afterRecord)}
			</div>
		</div>
	{/if}
</div>
