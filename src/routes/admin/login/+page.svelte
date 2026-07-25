<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<div class="flex min-h-[80vh] items-center justify-center px-4">
	<div class="w-full max-w-sm">
		<div class="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
			<h1 class="mb-6 text-center text-2xl font-bold">Admin Login</h1>

			{#if form?.error}
				<div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
					{form.error}
				</div>
			{/if}

			<form method="POST" use:enhance class="space-y-4">
				<div>
					<label for="username" class="mb-1 block text-sm font-medium">Username</label>
					<input
						id="username"
						name="username"
						type="text"
						value={form?.username ?? ''}
						required
						autocomplete="username"
						class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
					/>
				</div>
				<div>
					<label for="password" class="mb-1 block text-sm font-medium">Password</label>
					<input
						id="password"
						name="password"
						type="password"
						required
						autocomplete="current-password"
						class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
					/>
				</div>
				<button
					type="submit"
					class="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700"
				>
					Masuk
				</button>
			</form>
		</div>

		<p class="mt-4 text-center text-sm text-gray-500">
			<a href="/" class="text-blue-600 hover:underline">&larr; Kembali ke halaman utama</a>
		</p>
	</div>
</div>
