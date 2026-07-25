import { eq, and, gt } from 'drizzle-orm';
import { users, sessions } from './db/schema';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

const SALT_LENGTH = 16;
const ITERATIONS = 100_000;
const KEY_LENGTH = 32;

async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const hash = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
		keyMaterial,
		KEY_LENGTH * 8
	);
	const saltHex = [...salt].map((b) => b.toString(16).padStart(2, '0')).join('');
	const hashHex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
	return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [saltHex, hashHex] = stored.split(':');
	const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const hash = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
		keyMaterial,
		KEY_LENGTH * 8
	);
	const computedHex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
	return computedHex === hashHex;
}

export async function createUser(db: DrizzleD1Database, username: string, password: string) {
	const id = crypto.randomUUID();
	const passwordHash = await hashPassword(password);
	await db.insert(users).values({ id, username, passwordHash });
	return id;
}

export async function login(db: DrizzleD1Database, username: string, password: string): Promise<string | null> {
	const user = await db.select().from(users).where(eq(users.username, username)).get();
	if (!user) return null;
	const valid = await verifyPassword(password, user.passwordHash);
	if (!valid) return null;

	const sessionId = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
	await db.insert(sessions).values({ id: sessionId, userId: user.id, expiresAt });
	return sessionId;
}

export async function validateSession(db: DrizzleD1Database, sessionId: string) {
	const session = await db
		.select({ userId: sessions.userId, username: users.username })
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
		.get();
	return session ?? null;
}

export async function logout(db: DrizzleD1Database, sessionId: string) {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}
