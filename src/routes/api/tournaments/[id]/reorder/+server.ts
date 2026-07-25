import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { participants, tournaments } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, platform }) => {
	const db = getDb(platform!.env.DB);

	const tournament = await db
		.select()
		.from(tournaments)
		.where(eq(tournaments.id, params.id))
		.get();

	if (!tournament) return json({ error: 'Not found' }, { status: 404 });
	if (tournament.status !== 'draft') {
		return json({ error: 'Tournament already started' }, { status: 400 });
	}

	const { order } = await request.json() as { order: string[] };

	for (let i = 0; i < order.length; i++) {
		await db
			.update(participants)
			.set({ seed: i + 1 })
			.where(eq(participants.id, order[i]));
	}

	return json({ ok: true });
};
