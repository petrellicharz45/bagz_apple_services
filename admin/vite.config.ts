import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		include: [
			'firebase/app',
			'firebase/auth',
			'firebase/firestore',
			'firebase/storage',
			'firebase/functions'
		]
	},
	ssr: {
		noExternal: ['firebase', '@firebase/app', '@firebase/auth', '@firebase/firestore', '@firebase/storage']
	},
	server: {
		host: true,
		port: 5174,
		strictPort: true
	}
});
