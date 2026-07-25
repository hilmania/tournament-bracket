import { getDb } from '$lib/server/db';
import { tournaments } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform!.env.DB);
	const list = await db.select().from(tournaments).orderBy(desc(tournaments.createdAt));
	return { tournaments: list };
};
