import { pathToFileURL } from "url";
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import builtins from "builtin-modules";
import { PluginOption, defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

const DEV_DIRECTORY = "./";

const setOutDir = (mode: string) => {
	switch (mode) {
		case "development":
			return DEV_DIRECTORY;
		case "production":
			return "build";
	}
};

export default defineConfig(({ mode }) => {
	return {
		plugins: [
			svelte({ preprocess: vitePreprocess() }) as PluginOption,
			tailwindcss(),
		],
		build: {
			lib: {
				entry: "main.ts",
				formats: ["cjs"],
			},
			rollupOptions: {
				output: {
					entryFileNames: "main.js",
					assetFileNames: "styles.css",
				},
				sourcemapBaseUrl: pathToFileURL(
					"~/.md/.obsidian/plugins/obsidian-time-tracker",
				).toString(),
				external: [
					"obsidian",
					"electron",
					"@codemirror/autocomplete",
					"@codemirror/collab",
					"@codemirror/commands",
					"@codemirror/language",
					"@codemirror/lint",
					"@codemirror/search",
					"@codemirror/state",
					"@codemirror/view",
					"@lezer/common",
					"@lezer/highlight",
					"@lezer/lr",
					...builtins,
				],
			},
			outDir: setOutDir(mode),
			emptyOutDir: false,
			sourcemap: mode === "development" ? true : false,
		},
	};
});
