export async function handleError({ error }: { error: unknown }) {
	const message = error instanceof Error ? error.message : String(error);
	console.error('SvelteKit client error:', error);
	if (typeof document !== 'undefined') {
		const root = document.getElementById('admin-root') ?? document.body;
		if (!root.innerText.trim()) {
			root.innerHTML = `
				<div style="max-width:640px;margin:48px auto;padding:24px;font-family:system-ui,sans-serif;border:1px solid #fecaca;background:#fef2f2;border-radius:8px;color:#111">
					<h1 style="color:#b91c1c">Admin failed to load</h1>
					<pre style="white-space:pre-wrap">${message.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))}</pre>
				</div>
			`;
		}
	}
}
