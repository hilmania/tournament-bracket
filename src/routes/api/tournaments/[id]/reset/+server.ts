import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { tournaments, matches } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, platform }) => {
	const db = getDb(platform!.env.DB);

	const tournament = await db
		.select()
		.from(tournaments)
		.where(eq(tournaments.id, params.id))
		.get();

	if (!tournament) return json({ error: 'Not found' }, { status: 404 });
	if (tournament.status === 'draft') {
		return json({ error: 'Tournament is already in draft' }, { status: 400 });
	}

	await db.delete(matches).where(eq(matches.tournamentId, params.id));
	await db
		.update(tournaments)
		.set({ status: 'draft' })
		.where(eq(tournaments.id, params.id));

	return json({ ok: true });
};
