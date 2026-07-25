import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { matches, tournaments } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { advanceWinner } from '$lib/server/bracket';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, platform }) => {
	const db = getDb(platform!.env.DB);
	const body = await request.json() as { matchId: string; score1: number; score2: number };
	const { matchId, score1, score2 } = body;

	if (typeof score1 !== 'number' || typeof score2 !== 'number' || score1 === score2) {
		return json({ error: 'Scores must be different numbers' }, { status: 400 });
	}

	const match = await db.select().from(matches).where(eq(matches.id, matchId)).get();
	if (!match) return json({ error: 'Match not found' }, { status: 404 });
	if (!match.participant1Id || !match.participant2Id) {
		return json({ error: 'Match not ready' }, { status: 400 });
	}
	if (match.winnerId) {
		return json({ error: 'Match already scored' }, { status: 400 });
	}

	const winnerId = score1 > score2 ? match.participant1Id : match.participant2Id;

	await db
		.update(matches)
		.set({ score1, score2, winnerId, nowPlaying: false, finishedAt: new Date() })
		.where(eq(matches.id, matchId));

	await advanceWinner(db, params.id, matchId, winnerId);

	const allMatches = await db
		.select()
		.from(matches)
		.where(eq(matches.tournamentId, params.id));

	const maxRound = Math.max(...allMatches.map((m) => m.round));
	const finalMatch = allMatches.find((m) => m.round === maxRound);

	if (finalMatch?.winnerId) {
		await db
			.update(tournaments)
			.set({ status: 'completed' })
			.where(eq(tournaments.id, params.id));
	}

	return json({ ok: true, winnerId });
};
