import { createUser } from '../src/lib/server/auth';
import { getDb } from '../src/lib/server/db';
import { users } from '../src/lib/server/db/schema';
import { getPlatformProxy } from 'wrangler';

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
	console.error('Usage: npx tsx scripts/create-admin.ts <username> <password>');
	process.exit(1);
}

const proxy = await getPlatformProxy({ configPath: 'wrangler.toml' });
const db = getDb((proxy as any).env.DB);

const existing = await db.select().from(users).get();
if (existing) {
	console.log(`User "${existing.username}" sudah ada. Hanya 1 admin yang didukung untuk saat ini.`);
	process.exit(0);
}

await createUser(db, username, password);
console.log(`Admin user "${username}" berhasil dibuat.`);
process.exit(0);
