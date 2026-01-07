<script lang="ts">
	interface Props {
		startDate: Date;
		endDate?: Date | null;
		showEnd: boolean;
		onStartChanged: (date: Date) => void;
		onEndChanged: (date: Date) => void;
	}

	let {
		startDate,
		endDate = null,
		showEnd = true,
		onStartChanged,
		onEndChanged,
	}: Props = $props();

	let startTimeInput = $derived(toDateTimeLocal(startDate));
	let endTimeInput = $derived(endDate ? toDateTimeLocal(endDate) : null);

	function startChanged(e: Event) {
		const input = e.target as HTMLInputElement;
		const date = new Date(input.value);
		startDate = date;
		onStartChanged(date);
	}

	function endChanged(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.value) {
			const date = new Date(input.value);
			endDate = date;
			onEndChanged(date);
		}
	}

	function toDateTimeLocal(date: Date): string {
		const pad = (n: number) => n.toString().padStart(2, "0");
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
	}

	function adjustStart(minutes: number) {
		const date = new Date(startDate.getTime() + minutes * 60 * 1000);
		startDate = date;
		onStartChanged(date);
	}

	function adjustEnd(minutes: number) {
		if (endDate) {
			const date = new Date(endDate.getTime() + minutes * 60 * 1000);
			endDate = date;
			onEndChanged(date);
		}
	}
</script>

<div
	class="relative w-full h-fit bg-(--background-primary-alt) rounded-lg overflow-clip px-3 pt-1 pb-3 flex flex-col gap-2"
>
	<p class="w-full text-center text-sm">Start Time</p>
	<input
		class="w-full h-full rounded-md focus:outline-none focus:border-(--border-primary-focus)"
		type="datetime-local"
		value={startTimeInput}
		oninput={startChanged}
	/>
	<div class="flex flex-row gap-1 w-full">
		<button class="flex-1 py-1 rounded" onclick={() => adjustStart(-30)}
			>-30m</button
		>
		<button class="flex-1 py-1 rounded" onclick={() => adjustStart(-10)}
			>-10m</button
		>
		<button class="flex-1 py-1 rounded" onclick={() => adjustStart(-1)}
			>-1m</button
		>
		<button class="flex-1 py-1 rounded" onclick={() => adjustStart(1)}
			>+1m</button
		>
		<button class="flex-1 py-1 rounded" onclick={() => adjustStart(10)}
			>+10m</button
		>
		<button class="flex-1 py-1 rounded" onclick={() => adjustStart(30)}
			>+30m</button
		>
	</div>

	{#if showEnd}
		<p class="w-full text-center text-sm mt-3">End Time</p>
		<input
			class="text-lg w-full h-full rounded-md focus:outline-none focus:border-(--border-primary-focus)"
			type="datetime-local"
			value={endTimeInput}
			oninput={endChanged}
		/>
		<div class="flex flex-row gap-1 w-full">
			<button class="flex-1 py-1 rounded" onclick={() => adjustEnd(-30)}
				>-30m</button
			>
			<button class="flex-1 py-1 rounded" onclick={() => adjustEnd(-10)}
				>-10m</button
			>
			<button class="flex-1 py-1 rounded" onclick={() => adjustEnd(-1)}
				>-1m</button
			>
			<button class="flex-1 py-1 rounded" onclick={() => adjustEnd(1)}
				>+1m</button
			>
			<button class="flex-1 py-1 rounded" onclick={() => adjustEnd(10)}
				>+10m</button
			>
			<button class="flex-1 py-1 rounded" onclick={() => adjustEnd(30)}
				>+30m</button
			>
		</div>
	{/if}
</div>
