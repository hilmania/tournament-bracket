import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { tournaments } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ request, params, platform }) => {
	const db = getDb(platform!.env.DB);
	const { name } = await request.json() as { name: string };

	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	await db
		.update(tournaments)
		.set({ name: name.trim() })
		.where(eq(tournaments.id, params.id));

	return json({ ok: true, name: name.trim() });
};
