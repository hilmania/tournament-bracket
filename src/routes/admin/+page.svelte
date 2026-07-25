<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let name = $state('');
	let format = $state('single_leg');
	let creating = $state(false);

	async function createTournament() {
		if (!name.trim()) return;
		creating = true;
		const res = await fetch('/api/tournaments', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: name.trim(), format })
		});
		if (res.ok) {
			const { id } = await res.json() as { id: string };
			window.location.href = `/admin/tournament/${id}`;
		}
		creating = false;
	}
</script>

<div class="mx-auto max-w-3xl px-4 py-8">
	<div class="mb-8 flex items-center justify-between">
		<div class="flex items-center gap-3">
			<h1 class="text-3xl font-bold">Admin Panel</h1>
			<span class="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900 dark:text-red-300">Admin</span>
		</div>
		<div class="flex items-center gap-3">
			<a
				href="/admin/peserta"
				class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
			>
				Master Peserta
			</a>
			<a
				href="/"
				class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
			>
				Lihat Halaman Publik
			</a>
			<form method="POST" action="/admin/logout">
				<button
					type="submit"
					class="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
				>
					Logout
				</button>
			</form>
		</div>
	</div>

	<div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
		<h2 class="mb-4 text-lg font-semibold">Buat Turnamen Baru</h2>
		<form onsubmit={(e) => { e.preventDefault(); createTournament(); }} class="space-y-3">
			<div class="flex gap-3">
				<input
					type="text"
					bind:value={name}
					placeholder="Nama turnamen..."
					class="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
				/>
				<button
					type="submit"
					disabled={creating || !name.trim()}
					class="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
				>
					{creating ? 'Membuat...' : 'Buat'}
				</button>
			</div>
			<div class="flex items-center gap-4">
				<span class="text-sm text-gray-600 dark:text-gray-400">Format:</span>
				<label class="flex items-center gap-1.5 text-sm">
					<input type="radio" bind:group={format} value="single_leg" class="accent-blue-600" />
					Single Leg
				</label>
				<label class="flex items-center gap-1.5 text-sm">
					<input type="radio" bind:group={format} value="home_away" class="accent-blue-600" />
					Home & Away (2 Leg)
				</label>
			</div>
		</form>
	</div>

	{#if data.tournaments.length > 0}
		<h2 class="mb-4 text-lg font-semibold">Daftar Turnamen</h2>
		<div class="space-y-3">
			{#each data.tournaments as t}
				<a
					href="/admin/tournament/{t.id}"
					class="block rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
				>
					<div class="flex items-center justify-between">
						<span class="font-medium">{t.name}</span>
						<span
							class="rounded-full px-3 py-1 text-xs font-medium
								{t.status === 'draft' ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' : ''}
								{t.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : ''}
								{t.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : ''}"
						>
							{t.status === 'draft' ? 'Draft' : t.status === 'in_progress' ? 'Berlangsung' : 'Selesai'}
						</span>
					</div>
				</a>
			{/each}
		</div>
	{:else}
		<p class="text-center text-gray-500">Belum ada turnamen. Buat yang pertama!</p>
	{/if}
</div>
