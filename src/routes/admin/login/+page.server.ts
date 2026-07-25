import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { login } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, platform }) => {
	const sessionId = cookies.get('session');
	if (sessionId) {
		const { validateSession } = await import('$lib/server/auth');
		const db = getDb(platform!.env.DB);
		const session = await validateSession(db, sessionId);
		if (session) throw redirect(302, '/admin');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, platform }) => {
		const formData = await request.formData();
		const username = formData.get('username') as string;
		const password = formData.get('password') as string;

		if (!username || !password) {
			return fail(400, { error: 'Username dan password harus diisi', username });
		}

		const db = getDb(platform!.env.DB);
		const sessionId = await login(db, username, password);

		if (!sessionId) {
			return fail(401, { error: 'Username atau password salah', username });
		}

		cookies.set('session', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !import.meta.env.DEV,
			maxAge: 7 * 24 * 60 * 60
		});

		throw redirect(302, '/admin');
	}
};
