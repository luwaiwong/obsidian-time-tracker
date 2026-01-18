<script lang="ts">
	import TimeSelector from "./TimeSelector.svelte";

	interface StartTimeProps {
		value: Date;
		title?: string;
		customButton?: { label: string; onClick: () => void };
		onChanged: (date: Date) => void;
		minDate?: Date;
		maxDate?: Date;
	}

	interface EndTimeProps {
		value: Date | null;
		title?: string;
		customButton?: { label: string; onClick: () => void };
		onChanged: (date: Date) => void;
		minDate?: Date;
		maxDate?: Date;
	}

	interface Props {
		startTime: StartTimeProps;
		endTime?: EndTimeProps | null;
		gap?: string;
		marginTop?: string;
	}

	let {
		startTime,
		endTime = null,
		gap = "8px",
		marginTop = "8px",
	}: Props = $props();
</script>

<div
	class="time-grid-container"
	style="display: flex !important; flex-direction: column !important; gap: {gap} !important; margin-top: {marginTop} !important;"
>
	<div class="time-grid-start-container">
		<TimeSelector
			value={startTime.value}
			title={startTime.title || "Start Time"}
			customButton={startTime.customButton}
			onChanged={startTime.onChanged}
			minDate={startTime.minDate}
			maxDate={startTime.maxDate}
		/>
	</div>
	{#if endTime}
		<div class="time-grid-end-container">
			<TimeSelector
				value={endTime.value || new Date()}
				title={endTime.title || "End Time"}
				customButton={endTime.customButton}
				onChanged={endTime.onChanged}
				minDate={endTime.minDate}
				maxDate={endTime.maxDate}
			/>
		</div>
	{/if}
</div>

