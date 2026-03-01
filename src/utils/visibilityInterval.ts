// interval that pauses when the tab is hidden and resumes when visible
export function createVisibilityInterval(
	callback: () => void,
	ms: number,
): () => void {
	let interval: ReturnType<typeof setInterval> | undefined;

	function start() {
		if (interval) clearInterval(interval);
		callback();
		interval = setInterval(callback, ms);
	}

	function stop() {
		if (interval) clearInterval(interval);
		interval = undefined;
	}

	function onVisibilityChange() {
		if (document.visibilityState === "visible") {
			start();
		} else {
			stop();
		}
	}

	if (document.visibilityState === "visible") {
		start();
	}
	document.addEventListener("visibilitychange", onVisibilityChange);

	return () => {
		stop();
		document.removeEventListener("visibilitychange", onVisibilityChange);
	};
}
