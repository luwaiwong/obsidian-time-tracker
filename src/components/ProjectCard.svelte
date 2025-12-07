<script lang="ts">
import type { Project } from "../types";
import { formatDuration } from "../utils";

interface Props {
	project: Project;
	isRunning?: boolean;
	currentDuration?: number;
	onStart: () => void;
	onStop: () => void;
	onClick: () => void;
	gridColumns?: number;
}

let {
	project,
	isRunning = false,
	currentDuration = 0,
	onStart,
	onStop,
	onClick,
	gridColumns = 5,
}: Props = $props();

function getBaseFontSize(): number {
	if (gridColumns <= 2) return 20;
	if (gridColumns === 3) return 16;
	if (gridColumns === 4) return 14;
	if (gridColumns === 5) return 10;
	if (gridColumns === 6) return 8;
	return 8;
}

let baseFontSize = $derived(getBaseFontSize());
</script>

<div
    class="project-card"
    class:running={isRunning}
    style="background-color: {project.color}; font-size: {baseFontSize}px;"
    onclick={onClick}
    onkeydown={(e) => e.key === "Enter" && onClick()}
    role="button"
    tabindex="0"
>
    <span class="icon">{project.icon}</span>
    <div class="name">{project.name}</div>

    {#if isRunning}
        <div class="project-timer">
            {formatDuration(currentDuration)}
        </div>
        <div class="running-indicator">●</div>
    {/if}
</div>

<style>
    .project-card {
        position: relative;
        aspect-ratio: 1;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        color: white;
        text-align: center;
        overflow: hidden;
    }

    .project-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .project-card.running {
        animation: pulse 2s ease-in-out infinite;
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.5);
    }

    @keyframes pulse {
        0%,
        100% {
            box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.5);
        }
        50% {
            box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.3);
        }
    }

    .icon {
        display: block;
        font-weight: bold;
        font-size: 1.5em;
    }

    .name {
        font-size: 1em;
        font-weight: 600;
        word-wrap: break-word;
        max-width: 100%;
    }

    .project-timer {
        font-size: 0.85em;
        font-weight: 500;
        opacity: 0.9;
        margin-top: 0.25em;
    }

    .running-indicator {
        position: absolute;
        top: 0.5em;
        right: 0.5em;
        font-size: 1.2em;
        color: white;
        animation: blink 1.5s ease-in-out infinite;
    }

    @keyframes blink {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.3;
        }
    }
</style>
