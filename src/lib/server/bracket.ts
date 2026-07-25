import type { Database } from './db';
import { matches, participants } from './db/schema';
import { eq } from 'drizzle-orm';

export function generateBracket(
	participantList: { id: string; name: string; seed: number | null }[]
) {
	const count = participantList.length;
	const totalSlots = nextPowerOf2(count);
	const totalRounds = Math.log2(totalSlots);

	const slots: (typeof participantList[0] | null)[] = new Array(totalSlots).fill(null);
	for (const p of participantList) {
		const slotIndex = (p.seed ?? 999) - 1;
		if (slotIndex >= 0 && slotIndex < totalSlots) {
			slots[slotIndex] = p;
		}
	}

	const bracketMatches: {
		round: number;
		position: number;
		participant1Id: string | null;
		participant2Id: string | null;
	}[] = [];

	for (let round = 1; round <= totalRounds; round++) {
		const matchCount = totalSlots / Math.pow(2, round);
		for (let pos = 0; pos < matchCount; pos++) {
			const match: (typeof bracketMatches)[0] = {
				round,
				position: pos,
				participant1Id: null,
				participant2Id: null
			};

			if (round === 1) {
				const p1 = slots[pos * 2];
				const p2 = slots[pos * 2 + 1];
				match.participant1Id = p1?.id ?? null;
				match.participant2Id = p2?.id ?? null;
			}

			bracketMatches.push(match);
		}
	}

	return bracketMatches;
}

function nextPowerOf2(n: number): number {
	let p = 1;
	while (p < n) p *= 2;
	return p;
}


export async function autoAdvanceByes(db: Database, tournamentId: string) {
	const round1 = await db
		.select()
		.from(matches)
		.where(eq(matches.tournamentId, tournamentId));

	const r1 = round1.filter((m) => m.round === 1);

	for (const match of r1) {
		if (match.participant1Id && !match.participant2Id) {
			await db
				.update(matches)
				.set({ winnerId: match.participant1Id })
				.where(eq(matches.id, match.id));
			await advanceWinner(db, tournamentId, match.id, match.participant1Id);
		} else if (!match.participant1Id && match.participant2Id) {
			await db
				.update(matches)
				.set({ winnerId: match.participant2Id })
				.where(eq(matches.id, match.id));
			await advanceWinner(db, tournamentId, match.id, match.participant2Id);
		}
	}
}

export async function advanceWinner(
	db: Database,
	tournamentId: string,
	matchId: string,
	winnerId: string
) {
	const allMatches = await db
		.select()
		.from(matches)
		.where(eq(matches.tournamentId, tournamentId));

	const current = allMatches.find((m) => m.id === matchId);
	if (!current) return;

	const nextRound = current.round + 1;
	const nextPos = Math.floor(current.position / 2);
	const isTop = current.position % 2 === 0;

	const nextMatch = allMatches.find((m) => m.round === nextRound && m.position === nextPos);
	if (!nextMatch) return;

	await db
		.update(matches)
		.set(isTop ? { participant1Id: winnerId } : { participant2Id: winnerId })
		.where(eq(matches.id, nextMatch.id));
}
