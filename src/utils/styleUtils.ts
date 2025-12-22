import { setIcon } from "obsidian";
import type { Attachment } from "svelte/attachments";

export function icon(iconName: string): Attachment<HTMLElement> {
	return (node: HTMLElement) => {
		setIcon(node, iconName);
	};
}
