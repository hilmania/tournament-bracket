import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { getDb } from '$lib/server/db';
import { validateSession } from '$lib/server/auth';

let platform: App.Platform | undefined;

if (dev) {
	const { getPlatformProxy } = await import('wrangler');
	const proxy = await getPlatformProxy({ configPath: 'wrangler.toml' });
	platform = proxy as unknown as App.Platform;
}

export const handle: Handle = async ({ event, resolve }) => {
	if (dev && platform) {
		event.platform = platform;
	}

	const { pathname } = event.url;

	if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
		const sessionId = event.cookies.get('session');
		if (!sessionId) {
			throw redirect(302, '/admin/login');
		}

		const db = getDb(event.platform!.env.DB);
		const session = await validateSession(db, sessionId);
		if (!session) {
			event.cookies.delete('session', { path: '/' });
			throw redirect(302, '/admin/login');
		}

		event.locals.user = { username: session.username };
	}

	return resolve(event);
};
