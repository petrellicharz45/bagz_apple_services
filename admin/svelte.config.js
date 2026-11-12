import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		// cPanel/Apache often returns 403 for /_app/ — use a public folder name instead.
		appDir: 'adminstatic',
		adapter: adapter({
			fallback: 'index.html' // SPA mode
		})
	}
};

export default config;
