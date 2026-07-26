import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { tournaments } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ request, params, platform }) => {
	const db = getDb(platform!.env.DB);
	const body = await request.json() as { name?: string; format?: string };

	const updates: Record<string, string> = {};

	if (body.name !== undefined) {
		if (typeof body.name !== 'string' || body.name.trim().length === 0) {
			return json({ error: 'Name is required' }, { status: 400 });
		}
		updates.name = body.name.trim();
	}

	if (body.format !== undefined) {
		const validFormats = ['single_leg', 'home_away'];
		if (!validFormats.includes(body.format)) {
			return json({ error: 'Invalid format' }, { status: 400 });
		}
		updates.format = body.format;
	}

	if (Object.keys(updates).length === 0) {
		return json({ error: 'Nothing to update' }, { status: 400 });
	}

	await db
		.update(tournaments)
		.set(updates)
		.where(eq(tournaments.id, params.id));

	return json({ ok: true, ...updates });
};
