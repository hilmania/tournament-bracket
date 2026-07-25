declare global {
	namespace App {
		interface Locals {
			user?: { username: string };
		}
		interface Platform {
			env: {
				DB: D1Database;
			};
		}
	}
}

export {};
