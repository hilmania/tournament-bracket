import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { matches, tournaments } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { advanceWinner } from '$lib/server/bracket';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, platform }) => {
	const db = getDb(platform!.env.DB);
	const body = await request.json() as { matchId: string; score1: number; score2: number; leg?: number };
	const { matchId, score1, score2 } = body;

	if (typeof score1 !== 'number' || typeof score2 !== 'number') {
		return json({ error: 'Invalid scores' }, { status: 400 });
	}

	const match = await db.select().from(matches).where(eq(matches.id, matchId)).get();
	if (!match) return json({ error: 'Match not found' }, { status: 404 });
	if (!match.participant1Id || !match.participant2Id) {
		return json({ error: 'Match not ready' }, { status: 400 });
	}
	if (match.winnerId) {
		return json({ error: 'Match already scored' }, { status: 400 });
	}

	const tournament = await db.select().from(tournaments).where(eq(tournaments.id, params.id)).get();
	if (!tournament) return json({ error: 'Tournament not found' }, { status: 404 });

	if (tournament.format === 'home_away') {
		const leg = body.leg ?? (match.score1 === null ? 1 : 2);

		if (leg === 1) {
			await db
				.update(matches)
				.set({ score1, score2 })
				.where(eq(matches.id, matchId));
			return json({ ok: true, leg: 1 });
		}

		const agg1 = (match.score1 ?? 0) + score1;
		const agg2 = (match.score2 ?? 0) + score2;

		if (agg1 === agg2) {
			return json({ error: 'Skor agregat tidak boleh seri' }, { status: 400 });
		}

		const winnerId = agg1 > agg2 ? match.participant1Id : match.participant2Id;

		await db
			.update(matches)
			.set({ score1Leg2: score1, score2Leg2: score2, winnerId, nowPlaying: false, finishedAt: new Date() })
			.where(eq(matches.id, matchId));

		await advanceWinner(db, params.id, matchId, winnerId);
	} else {
		if (score1 === score2) {
			return json({ error: 'Scores must be different numbers' }, { status: 400 });
		}

		const winnerId = score1 > score2 ? match.participant1Id : match.participant2Id;

		await db
			.update(matches)
			.set({ score1, score2, winnerId, nowPlaying: false, finishedAt: new Date() })
			.where(eq(matches.id, matchId));

		await advanceWinner(db, params.id, matchId, winnerId);
	}

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

	return json({ ok: true });
};
