import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { tournaments, participants, matches } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getDb(platform!.env.DB);

	const tournament = await db
		.select()
		.from(tournaments)
		.where(eq(tournaments.id, params.id))
		.get();

	if (!tournament) throw error(404, 'Tournament not found');

	const participantList = await db
		.select()
		.from(participants)
		.where(eq(participants.tournamentId, params.id));

	const matchList = await db
		.select()
		.from(matches)
		.where(eq(matches.tournamentId, params.id));

	return {
		tournament,
		participants: participantList,
		matches: matchList
	};
};
