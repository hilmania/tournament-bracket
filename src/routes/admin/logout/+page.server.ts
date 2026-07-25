import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { logout } from '$lib/server/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ cookies, platform }) => {
		const sessionId = cookies.get('session');
		if (sessionId) {
			const db = getDb(platform!.env.DB);
			await logout(db, sessionId);
			cookies.delete('session', { path: '/' });
		}
		throw redirect(302, '/admin/login');
	}
};
