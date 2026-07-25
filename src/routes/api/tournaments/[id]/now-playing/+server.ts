import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { matches } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, platform }) => {
	const db = getDb(platform!.env.DB);
	const { matchId } = await request.json() as { matchId: string };

	const match = await db.select().from(matches).where(
		and(eq(matches.id, matchId), eq(matches.tournamentId, params.id))
	).get();

	if (!match) return json({ error: 'Match not found' }, { status: 404 });

	const newValue = !match.nowPlaying;

	await db.update(matches).set({ nowPlaying: false }).where(eq(matches.tournamentId, params.id));

	if (newValue) {
		await db.update(matches).set({
			nowPlaying: true,
			startedAt: match.startedAt ?? new Date()
		}).where(eq(matches.id, matchId));
	}

	return json({ ok: true, nowPlaying: newValue, startedAt: match.startedAt?.toISOString() ?? new Date().toISOString() });
};
