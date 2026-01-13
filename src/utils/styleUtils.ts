import { setIcon } from "obsidian";
import MiniTitle from "../components/MiniTitle.svelte";
import { mount } from "svelte";
import type { Attachment } from "svelte/attachments";

export function icon(iconName: string): Attachment<HTMLElement> {
	return (node: HTMLElement) => {
		setIcon(node, iconName);
	};
}


export function mountMiniTitle(container: HTMLElement, text: string) {
	return mount(MiniTitle, {
		target: container,
		props: {
			text,
		},
	});
}

export function mountSpacer(container: HTMLElement, size: number) {
	container.createEl("div").style.cssText = `margin: 0 0 ${size}px 0;`;
}

// yield to main thread to prevent UI blocking
export function yieldToMain(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}