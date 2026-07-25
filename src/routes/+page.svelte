<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const publicTournaments = $derived(
		data.tournaments.filter((t) => t.status !== 'draft')
	);
</script>

<div class="mx-auto max-w-3xl px-4 py-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold">Tournament Bracket</h1>
	</div>

	{#if publicTournaments.length > 0}
		<div class="space-y-3">
			{#each publicTournaments as t}
				<a
					href="/tournament/{t.id}"
					class="block rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
				>
					<div class="flex items-center justify-between">
						<span class="font-medium">{t.name}</span>
						<span
							class="rounded-full px-3 py-1 text-xs font-medium
								{t.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : ''}
								{t.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : ''}"
						>
							{t.status === 'in_progress' ? 'Berlangsung' : 'Selesai'}
						</span>
					</div>
				</a>
			{/each}
		</div>
	{:else}
		<p class="text-center text-gray-500">Belum ada turnamen.</p>
	{/if}
</div>
