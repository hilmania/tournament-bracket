import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { participants, tournaments, masterParticipants } from '$lib/server/db/schema';
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

	const body = await request.json() as {
		name: string;
		masterParticipantId?: string;
		avatar?: string | null;
	};

	if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	const existing = await db
		.select()
		.from(participants)
		.where(eq(participants.tournamentId, params.id));

	let masterId = body.masterParticipantId ?? null;
	let avatar = body.avatar ?? null;

	if (masterId) {
		const master = await db
			.select()
			.from(masterParticipants)
			.where(eq(masterParticipants.id, masterId))
			.get();
		if (master) {
			avatar = avatar ?? master.avatar;
		}
	} else {
		const newMasterId = crypto.randomUUID();
		await db.insert(masterParticipants).values({
			id: newMasterId,
			name: body.name.trim(),
			avatar,
			createdAt: new Date()
		});
		masterId = newMasterId;
	}

	const id = crypto.randomUUID();
	await db.insert(participants).values({
		id,
		tournamentId: params.id,
		name: body.name.trim(),
		seed: existing.length + 1,
		avatar,
		masterParticipantId: masterId
	});

	return json({
		id,
		tournamentId: params.id,
		name: body.name.trim(),
		seed: existing.length + 1,
		avatar,
		masterParticipantId: masterId
	});
};

export const PATCH: RequestHandler = async ({ request, params, platform }) => {
	const db = getDb(platform!.env.DB);
	const body = await request.json() as {
		participantId: string;
		name?: string;
		avatar?: string | null;
	};

	const updates: Record<string, unknown> = {};
	if (body.name && body.name.trim().length > 0) updates.name = body.name.trim();
	if (body.avatar !== undefined) updates.avatar = body.avatar;

	if (Object.keys(updates).length === 0) {
		return json({ error: 'Nothing to update' }, { status: 400 });
	}

	await db
		.update(participants)
		.set(updates)
		.where(eq(participants.id, body.participantId));

	const participant = await db
		.select()
		.from(participants)
		.where(eq(participants.id, body.participantId))
		.get();

	if (participant?.masterParticipantId) {
		await db
			.update(masterParticipants)
			.set(updates)
			.where(eq(masterParticipants.id, participant.masterParticipantId));
	}

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request, params, platform }) => {
	const db = getDb(platform!.env.DB);
	const { participantId } = await request.json() as { participantId: string };

	await db.delete(participants).where(eq(participants.id, participantId));

	const remaining = await db
		.select()
		.from(participants)
		.where(eq(participants.tournamentId, params.id));

	const sorted = remaining.sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
	for (let i = 0; i < sorted.length; i++) {
		await db
			.update(participants)
			.set({ seed: i + 1 })
			.where(eq(participants.id, sorted[i].id));
	}

	return json({ ok: true });
};
