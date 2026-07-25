import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { tournaments } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = getDb(platform!.env.DB);
	const { name, format } = await request.json() as { name: string; format?: string };

	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	const validFormats = ['single_leg', 'home_away'];
	const tournamentFormat = validFormats.includes(format ?? '') ? format! : 'single_leg';

	const id = crypto.randomUUID();
	await db.insert(tournaments).values({
		id,
		name: name.trim(),
		type: 'single_elimination',
		format: tournamentFormat as 'single_leg' | 'home_away',
		status: 'draft',
		createdAt: new Date()
	});

	return json({ id });
};
