import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { masterParticipants } from '$lib/server/db/schema';
import { like, desc, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	const db = getDb(platform!.env.DB);
	const q = url.searchParams.get('q')?.trim();

	let query = db.select().from(masterParticipants);
	if (q) {
		query = query.where(like(masterParticipants.name, `%${q}%`)) as typeof query;
	}

	const list = await query.orderBy(desc(masterParticipants.createdAt));
	return json(list);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = getDb(platform!.env.DB);
	const { name, avatar } = await request.json() as { name: string; avatar?: string | null };

	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	const id = crypto.randomUUID();
	await db.insert(masterParticipants).values({
		id,
		name: name.trim(),
		avatar: avatar ?? null,
		createdAt: new Date()
	});

	return json({ id, name: name.trim(), avatar: avatar ?? null, createdAt: new Date() });
};

export const PATCH: RequestHandler = async ({ request, platform }) => {
	const db = getDb(platform!.env.DB);
	const { id, name, avatar } = await request.json() as {
		id: string;
		name?: string;
		avatar?: string | null;
	};

	const updates: Record<string, unknown> = {};
	if (name && name.trim().length > 0) updates.name = name.trim();
	if (avatar !== undefined) updates.avatar = avatar;

	if (Object.keys(updates).length === 0) {
		return json({ error: 'Nothing to update' }, { status: 400 });
	}

	await db
		.update(masterParticipants)
		.set(updates)
		.where(eq(masterParticipants.id, id));

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request, platform }) => {
	const db = getDb(platform!.env.DB);
	const { id } = await request.json() as { id: string };

	await db.delete(masterParticipants).where(eq(masterParticipants.id, id));
	return json({ ok: true });
};
