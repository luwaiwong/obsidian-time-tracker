// eslint-disable-next-line import/no-nodejs-modules
import { pathToFileURL } from "node:url";
// eslint-disable-next-line import/no-nodejs-modules
import { builtinModules } from "node:module";
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { PluginOption, defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

const DEV_DIRECTORY = "../../.md";

const setOutDir = (mode: string) => {
	switch (mode) {
		case "development":
			return `${DEV_DIRECTORY}/.obsidian/plugins/time-tracker`;
		case "production":
			return "./build";
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
					// eslint-disable-next-line obsidianmd/hardcoded-config-path
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
					...builtinModules,
				],
			},
			outDir: setOutDir(mode),
			emptyOutDir: false,
			sourcemap: mode === "development" ? true : false,
		},
	};
});
