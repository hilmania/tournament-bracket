const password = process.argv[2];
if (!password) {
	console.error('Usage: npx tsx scripts/generate-hash.ts <password>');
	process.exit(1);
}

const encoder = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits(
	{ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
	keyMaterial,
	256
);
const hashArray = new Uint8Array(bits);
const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
const result = `${saltHex}:${hashHex}`;

const id = crypto.randomUUID();
const now = Math.floor(Date.now() / 1000);

console.log('\nJalankan perintah ini untuk membuat admin di remote:\n');
console.log(`npx wrangler d1 execute tournament-bracket-db --remote --command "INSERT INTO users (id, username, password_hash, created_at) VALUES ('${id}', 'admin', '${result}', ${now});"`);
