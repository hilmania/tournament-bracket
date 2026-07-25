<script lang="ts">
	import type { PageData } from './$types';
	import BracketView from '$lib/components/BracketView.svelte';

	let { data }: { data: PageData } = $props();

	let matchList = $state(data.matches.slice());
	let participantList = $state(data.participants.slice());
	let tournament = $state(structuredClone(data.tournament));
</script>

<div class="mx-auto max-w-7xl px-4 py-8">
	<div class="mb-6 flex items-center gap-4">
		<a href="/" class="text-blue-600 hover:underline">&larr; Kembali</a>
		<h1 class="text-2xl font-bold">{tournament.name}</h1>
		<span
			class="rounded-full px-3 py-1 text-xs font-medium
				{tournament.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : ''}
				{tournament.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : ''}"
		>
			{tournament.status === 'in_progress' ? 'Berlangsung' : 'Selesai'}
		</span>
	</div>

	{#if tournament.status !== 'draft'}
		<BracketView
			matches={matchList}
			participants={participantList}
			status={tournament.status}
			format={tournament.format}
		/>
	{:else}
		<p class="text-center text-gray-500">Turnamen ini belum dimulai.</p>
	{/if}
</div>
