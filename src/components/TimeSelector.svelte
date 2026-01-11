<script lang="ts">
	import MiniTitle from "./MiniTitle.svelte";

	interface Props {
		value: Date;
		title?: string;
		customButton?: { label: string; onClick: () => void };
		onChanged: (date: Date) => void;
		minDate?: Date;
		maxDate?: Date;
	}

	let {
		value,
		title = "Time",
		customButton,
		onChanged,
		minDate,
		maxDate,
	}: Props = $props();

	let clampedValue = $derived(clampDate(value));
	let timeInput = $derived(toDateTimeLocal(clampedValue));
	let minInput = $derived(minDate ? toDateTimeLocal(minDate) : undefined);
	let maxInput = $derived(maxDate ? toDateTimeLocal(maxDate) : undefined);

	$effect(() => {
		if (clampedValue.getTime() !== value.getTime()) {
			onChanged(clampedValue);
		}
	});

	function timeChanged(e: Event) {
		const input = e.target as HTMLInputElement;
		let date = new Date(input.value);
		date = clampDate(date);
		value = date;
		onChanged(date);
	}

	function toDateTimeLocal(date: Date): string {
		const pad = (n: number) => n.toString().padStart(2, "0");
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
	}

	function clampDate(date: Date): Date {
		if (minDate && date.getTime() < minDate.getTime()) {
			return new Date(minDate);
		}
		if (maxDate && date.getTime() > maxDate.getTime()) {
			return new Date(maxDate);
		}
		return date;
	}

	function adjust(minutes: number) {
		let date = new Date(value.getTime() + minutes * 60 * 1000);
		date = clampDate(date);
		value = date;
		onChanged(date);
	}
</script>

<div class="flex flex-col gap-1 w-full">
	<MiniTitle>{title}</MiniTitle>
	<div
		class="relative w-full h-fit bg-(--background-primary-alt) rounded-lg overflow-clip px-3 py-3 flex flex-col gap-2"
	>
		<input
			class="w-full h-full rounded-md focus:outline-none focus:border-(--border-primary-focus)"
			type="datetime-local"
			value={timeInput}
			min={minInput}
			max={maxInput}
			oninput={timeChanged}
		/>
		<div class="flex flex-row gap-1 w-full">
			<button class="flex-1 py-1 rounded" onclick={() => adjust(-30)}
				>-30</button
			>
			<button class="flex-1 py-1 rounded" onclick={() => adjust(-5)}
				>-5</button
			>
			<button class="flex-1 py-1 rounded" onclick={() => adjust(-1)}
				>-1</button
			>
			{#if customButton}
				<button
					class="flex-1 py-1 rounded"
					onclick={customButton.onClick}
				>
					{customButton.label}
				</button>
			{/if}
			<button class="flex-1 py-1 rounded" onclick={() => adjust(1)}
				>+1</button
			>
			<button class="flex-1 py-1 rounded" onclick={() => adjust(5)}
				>+5</button
			>
			<button class="flex-1 py-1 rounded" onclick={() => adjust(30)}
				>+30</button
			>
		</div>
	</div>
</div>
