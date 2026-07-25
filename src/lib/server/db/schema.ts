import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const tournaments = sqliteTable('tournaments', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	type: text('type', { enum: ['single_elimination', 'double_elimination'] })
		.notNull()
		.default('single_elimination'),
	status: text('status', { enum: ['draft', 'in_progress', 'completed'] })
		.notNull()
		.default('draft'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const masterParticipants = sqliteTable('master_participants', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	avatar: text('avatar'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const participants = sqliteTable('participants', {
	id: text('id').primaryKey(),
	tournamentId: text('tournament_id')
		.notNull()
		.references(() => tournaments.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	seed: integer('seed'),
	avatar: text('avatar'),
	masterParticipantId: text('master_participant_id').references(() => masterParticipants.id)
});

export const matches = sqliteTable('matches', {
	id: text('id').primaryKey(),
	tournamentId: text('tournament_id')
		.notNull()
		.references(() => tournaments.id, { onDelete: 'cascade' }),
	round: integer('round').notNull(),
	position: integer('position').notNull(),
	participant1Id: text('participant1_id').references(() => participants.id),
	participant2Id: text('participant2_id').references(() => participants.id),
	winnerId: text('winner_id').references(() => participants.id),
	score1: integer('score1'),
	score2: integer('score2'),
	nextMatchId: text('next_match_id'),
	nowPlaying: integer('now_playing', { mode: 'boolean' }).notNull().default(false),
	startedAt: integer('started_at', { mode: 'timestamp' }),
	finishedAt: integer('finished_at', { mode: 'timestamp' })
});

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
}, (table) => [
	index('sessions_user_id_idx').on(table.userId)
]);
