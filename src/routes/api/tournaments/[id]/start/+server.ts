import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { tournaments, participants, matches } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { generateBracket, autoAdvanceByes } from '$lib/server/bracket';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, platform }) => {
	const db = getDb(platform!.env.DB);

	const tournament = await db
		.select()
		.from(tournaments)
		.where(eq(tournaments.id, params.id))
		.get();

	if (!tournament) return json({ error: 'Not found' }, { status: 404 });
	if (tournament.status !== 'draft') {
		return json({ error: 'Already started' }, { status: 400 });
	}

	const participantList = await db
		.select()
		.from(participants)
		.where(eq(participants.tournamentId, params.id));

	if (participantList.length < 2) {
		return json({ error: 'Need at least 2 participants' }, { status: 400 });
	}

	const bracket = generateBracket(participantList);

	for (const match of bracket) {
		await db.insert(matches).values({
			id: crypto.randomUUID(),
			tournamentId: params.id,
			round: match.round,
			position: match.position,
			participant1Id: match.participant1Id,
			participant2Id: match.participant2Id
		});
	}

	await db
		.update(tournaments)
		.set({ status: 'in_progress' })
		.where(eq(tournaments.id, params.id));

	await autoAdvanceByes(db, params.id);

	return json({ ok: true });
};
