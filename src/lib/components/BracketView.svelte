<script lang="ts">
	import { tick } from 'svelte';

	type Participant = { id: string; name: string; seed: number | null; avatar: string | null };
	type Match = {
		id: string;
		round: number;
		position: number;
		participant1Id: string | null;
		participant2Id: string | null;
		winnerId: string | null;
		score1: number | null;
		score2: number | null;
		score1Leg2: number | null;
		score2Leg2: number | null;
		nowPlaying: boolean;
		startedAt: string | Date | null;
		finishedAt: string | Date | null;
	};

	function formatDateTime(val: string | Date | null): string {
		if (!val) return '';
		const d = val instanceof Date ? val : new Date(val);
		return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
			+ ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
	}

	let {
		matches,
		participants,
		status,
		format = 'single_leg',
		admin = false,
		onScore,
		onNowPlaying
	}: {
		matches: Match[];
		participants: Participant[];
		status: string;
		format?: string;
		admin?: boolean;
		onScore?: (matchId: string, score1: number, score2: number, leg?: number) => void;
		onNowPlaying?: (matchId: string) => void;
	} = $props();

	let scoringMatch = $state<string | null>(null);
	let selectedMatch = $state<string | null>(null);
	let s1 = $state(0);
	let s2 = $state(0);
	let detailPanelEl = $state<HTMLDivElement | null>(null);

	function getParticipant(id: string | null): Participant | null {
		if (!id) return null;
		return participants.find((p) => p.id === id) ?? null;
	}

	function getName(id: string | null): string {
		return getParticipant(id)?.name ?? 'TBD';
	}

	function getAvatar(id: string | null): string | null {
		return getParticipant(id)?.avatar ?? null;
	}

	function matchStatus(match: Match): 'upcoming' | 'ready' | 'now_playing' | 'completed' | 'bye' | 'leg1_done' {
		if (match.winnerId) return 'completed';
		if (!match.participant1Id && !match.participant2Id) return 'upcoming';
		if (!match.participant1Id || !match.participant2Id) return 'bye';
		if (match.nowPlaying) return 'now_playing';
		if (format === 'home_away' && match.score1 !== null && match.score1Leg2 === null) return 'leg1_done';
		return 'ready';
	}

	function matchStatusLabel(s: ReturnType<typeof matchStatus>): string {
		switch (s) {
			case 'now_playing': return 'Sedang Berlangsung';
			case 'ready': return 'Siap Dimainkan';
			case 'completed': return 'Selesai';
			case 'upcoming': return 'Menunggu';
			case 'bye': return 'BYE';
			case 'leg1_done': return 'Leg 1 Selesai';
		}
	}

	const rounds = $derived(() => {
		const maxRound = Math.max(...matches.map((m) => m.round));
		const result: Match[][] = [];
		for (let r = 1; r <= maxRound; r++) {
			result.push(
				matches.filter((m) => m.round === r).sort((a, b) => a.position - b.position)
			);
		}
		return result;
	});

	function roundLabel(round: number, total: number): string {
		if (round === total) return 'Final';
		if (round === total - 1) return 'Semi Final';
		if (round === total - 2) return 'Quarter Final';
		return `Round ${round}`;
	}

	async function selectMatch(matchId: string) {
		selectedMatch = selectedMatch === matchId ? null : matchId;
		if (selectedMatch) {
			await tick();
			detailPanelEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}

	function currentLeg(match: Match): number {
		if (format !== 'home_away') return 1;
		return match.score1 === null ? 1 : 2;
	}

	function openScoring(matchId: string) {
		scoringMatch = matchId;
		s1 = 0;
		s2 = 0;
	}

	function confirmScore() {
		if (!scoringMatch) return;
		const match = matches.find((m) => m.id === scoringMatch);
		if (!match) return;
		const leg = currentLeg(match);
		if (format === 'home_away') {
			if (leg === 2) {
				const agg1 = (match.score1 ?? 0) + s1;
				const agg2 = (match.score2 ?? 0) + s2;
				if (agg1 === agg2) return;
			}
			onScore?.(scoringMatch, s1, s2, leg);
		} else {
			if (s1 === s2) return;
			onScore?.(scoringMatch, s1, s2);
		}
		scoringMatch = null;
	}

	const champion = $derived(() => {
		if (status !== 'completed') return null;
		const maxRound = Math.max(...matches.map((m) => m.round));
		const final = matches.find((m) => m.round === maxRound);
		if (!final?.winnerId) return null;
		return getParticipant(final.winnerId);
	});

	const selectedMatchData = $derived(() => {
		if (!selectedMatch) return null;
		return matches.find((m) => m.id === selectedMatch) ?? null;
	});
</script>

{#if champion()}
	<div class="mb-6 rounded-lg border-2 border-yellow-400 bg-yellow-50 p-6 text-center dark:border-yellow-600 dark:bg-yellow-900/30">
		<div class="text-4xl">&#127942;</div>
		{#if champion()?.avatar}
			<img src={champion()?.avatar} alt={champion()?.name} class="mx-auto mt-3 h-24 w-24 rounded-full border-4 border-yellow-400 object-cover shadow-lg" />
		{/if}
		<h2 class="mt-2 text-2xl font-bold text-yellow-700 dark:text-yellow-300">Juara: {champion()?.name}</h2>
	</div>
{/if}

<!-- Match Detail Panel (above bracket) -->
{#if selectedMatchData()}
	{@const match = selectedMatchData()!}
	{@const mStatus = matchStatus(match)}
	{@const p1 = getParticipant(match.participant1Id)}
	{@const p2 = getParticipant(match.participant2Id)}
	{@const winner = match.winnerId ? getParticipant(match.winnerId) : null}
	<div
		bind:this={detailPanelEl}
		class="mb-6 overflow-hidden rounded-lg border-2 shadow-sm
		{mStatus === 'now_playing' ? 'border-amber-400 dark:border-amber-500' : mStatus === 'completed' ? 'border-green-300 dark:border-green-700' : mStatus === 'ready' ? 'border-green-300 dark:border-green-600' : 'border-gray-200 dark:border-gray-700'}"
	>
		<!-- Header -->
		<div class="flex items-center justify-between px-6 py-3
			{mStatus === 'now_playing' ? 'bg-amber-50 dark:bg-amber-900/20' : mStatus === 'completed' ? 'bg-green-50 dark:bg-green-900/20' : mStatus === 'ready' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800'}">
			<div class="flex items-center gap-2">
				{#if mStatus === 'now_playing'}
					<span class="relative flex h-3 w-3">
						<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
						<span class="relative inline-flex h-3 w-3 rounded-full bg-amber-500"></span>
					</span>
				{/if}
				<span class="text-sm font-semibold
					{mStatus === 'now_playing' ? 'text-amber-700 dark:text-amber-300' : mStatus === 'completed' ? 'text-green-700 dark:text-green-300' : mStatus === 'ready' ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-400'}">
					{matchStatusLabel(mStatus)}
				</span>
			</div>
			<div class="flex items-center gap-3">
				<span class="text-xs text-gray-500">
					{roundLabel(match.round, rounds().length)} &middot; Pertandingan {match.position + 1}
				</span>
				<button
					onclick={() => selectedMatch = null}
					class="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-600 dark:hover:text-gray-300"
					title="Tutup"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
				</button>
			</div>
		</div>

		<!-- Versus display -->
		<div class="bg-white px-6 py-8 dark:bg-gray-800">
			<div class="flex items-center justify-center gap-8">
				<!-- Player 1 -->
				<div class="flex flex-1 flex-col items-center gap-3 text-center">
					{#if p1?.avatar}
						<img src={p1.avatar} alt={p1.name} class="h-36 w-36 rounded-full border-4 object-cover shadow-lg
							{winner?.id === p1.id ? 'border-green-400' : 'border-gray-200 dark:border-gray-600'}" />
					{:else if p1}
						<div class="flex h-36 w-36 items-center justify-center rounded-full border-4 text-4xl font-bold shadow-lg
							{winner?.id === p1.id ? 'border-green-400 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'border-gray-200 bg-blue-100 text-blue-600 dark:border-gray-600 dark:bg-blue-900 dark:text-blue-300'}">
							{p1.name.charAt(0).toUpperCase()}
						</div>
					{:else}
						<div class="flex h-36 w-36 items-center justify-center rounded-full border-4 border-gray-200 bg-gray-100 text-3xl text-gray-400 dark:border-gray-600 dark:bg-gray-700">?</div>
					{/if}
					<span class="text-lg font-semibold {winner?.id === p1?.id ? 'text-green-700 dark:text-green-300' : ''}">{p1?.name ?? 'TBD'}</span>
					{#if match.score1 !== null}
						<span class="text-4xl font-bold tabular-nums {winner?.id === p1?.id ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}">{match.score1}</span>
					{/if}
				</div>

				<!-- VS -->
				<div class="flex flex-col items-center">
					<span class="text-3xl font-black text-gray-300 dark:text-gray-600">VS</span>
				</div>

				<!-- Player 2 -->
				<div class="flex flex-1 flex-col items-center gap-3 text-center">
					{#if p2?.avatar}
						<img src={p2.avatar} alt={p2.name} class="h-36 w-36 rounded-full border-4 object-cover shadow-lg
							{winner?.id === p2.id ? 'border-green-400' : 'border-gray-200 dark:border-gray-600'}" />
					{:else if p2}
						<div class="flex h-36 w-36 items-center justify-center rounded-full border-4 text-4xl font-bold shadow-lg
							{winner?.id === p2.id ? 'border-green-400 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'border-gray-200 bg-orange-100 text-orange-600 dark:border-gray-600 dark:bg-orange-900 dark:text-orange-300'}">
							{p2.name.charAt(0).toUpperCase()}
						</div>
					{:else}
						<div class="flex h-36 w-36 items-center justify-center rounded-full border-4 border-gray-200 bg-gray-100 text-3xl text-gray-400 dark:border-gray-600 dark:bg-gray-700">?</div>
					{/if}
					<span class="text-lg font-semibold {winner?.id === p2?.id ? 'text-green-700 dark:text-green-300' : ''}">{p2?.name ?? 'TBD'}</span>
					{#if match.score2 !== null}
						<span class="text-4xl font-bold tabular-nums {winner?.id === p2?.id ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}">{match.score2}</span>
					{/if}
				</div>
			</div>

			<!-- Winner banner -->
			{#if winner}
				<div class="mt-5 rounded-lg bg-green-50 px-4 py-2 text-center dark:bg-green-900/30">
					<span class="text-sm font-medium text-green-700 dark:text-green-300">Pemenang: {winner.name}</span>
				</div>
			{/if}

			<!-- Timestamps -->
			{#if match.startedAt || match.finishedAt}
				<div class="mt-3 flex items-center justify-center gap-6 text-xs text-gray-500 dark:text-gray-400">
					{#if match.startedAt}
						<span>Mulai: {formatDateTime(match.startedAt)}</span>
					{/if}
					{#if match.finishedAt}
						<span>Selesai: {formatDateTime(match.finishedAt)}</span>
					{/if}
				</div>
			{/if}

			<!-- Leg scores for home_away -->
			{#if format === 'home_away' && match.score1 !== null}
				<div class="mt-4 rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-700/50">
					<div class="mb-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">Skor per Leg</div>
					<div class="flex items-center justify-center gap-6 text-sm">
						<div class="text-center">
							<div class="text-xs text-gray-400">Leg 1</div>
							<div class="font-mono font-bold">{match.score1} - {match.score2}</div>
						</div>
						{#if match.score1Leg2 !== null}
							<div class="text-center">
								<div class="text-xs text-gray-400">Leg 2</div>
								<div class="font-mono font-bold">{match.score1Leg2} - {match.score2Leg2}</div>
							</div>
							<div class="text-center">
								<div class="text-xs text-gray-400">Agregat</div>
								<div class="font-mono text-lg font-bold">{(match.score1 ?? 0) + (match.score1Leg2 ?? 0)} - {(match.score2 ?? 0) + (match.score2Leg2 ?? 0)}</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Action buttons (admin only) -->
			{#if admin && (mStatus === 'ready' || mStatus === 'now_playing' || mStatus === 'leg1_done') && status === 'in_progress'}
				<div class="mt-5 flex items-center justify-center gap-3">
					<button
						onclick={() => onNowPlaying?.(match.id)}
						class="rounded-lg px-6 py-2.5 font-medium transition
							{mStatus === 'now_playing'
								? 'border-2 border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50'
								: 'border-2 border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'}"
					>
						{mStatus === 'now_playing' ? '✓ Sedang Dimainkan' : '▶ Mainkan Sekarang'}
					</button>
					<button
						onclick={() => openScoring(match.id)}
						class="rounded-lg bg-blue-600 px-8 py-2.5 font-medium text-white hover:bg-blue-700"
					>
						{format === 'home_away' ? `Input Skor Leg ${currentLeg(match)}` : 'Input Skor'}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<div class="overflow-x-auto rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
	<div class="flex gap-8" style="min-width: max-content;">
		{#each rounds() as roundMatches, roundIndex}
			<div class="flex flex-col">
				<h3 class="mb-4 text-center text-sm font-semibold text-gray-500">
					{roundLabel(roundIndex + 1, rounds().length)}
				</h3>
				<div
					class="flex flex-1 flex-col justify-around"
					style="gap: {Math.pow(2, roundIndex) * 1.5}rem;"
				>
					{#each roundMatches as match}
						{@const mStatus = matchStatus(match)}
						{@const isSelected = selectedMatch === match.id}
						{@const canScore = (mStatus === 'ready' || mStatus === 'now_playing' || mStatus === 'leg1_done') && status === 'in_progress'}
						<button
							type="button"
							onclick={() => selectMatch(match.id)}
							class="w-72 rounded-lg border-2 text-left shadow-sm transition-all
								{isSelected
									? 'border-blue-500 ring-2 ring-blue-200 dark:border-blue-400 dark:ring-blue-900'
									: mStatus === 'now_playing'
										? 'border-amber-400 dark:border-amber-500'
										: mStatus === 'leg1_done'
											? 'border-blue-300 dark:border-blue-600'
											: mStatus === 'ready'
												? 'border-green-300 dark:border-green-600'
												: 'border-gray-200 dark:border-gray-600'}
								{mStatus === 'now_playing' && !isSelected ? 'animate-pulse-subtle' : ''}
								hover:border-blue-400 hover:shadow-md dark:hover:border-blue-500"
						>
							{#if mStatus === 'now_playing'}
								<div class="flex items-center justify-center gap-1.5 border-b border-amber-200 bg-amber-50 px-3 py-1 dark:border-amber-800 dark:bg-amber-900/30">
									<span class="relative flex h-2 w-2">
										<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
										<span class="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
									</span>
									<span class="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Now Playing</span>
								</div>
							{:else if mStatus === 'leg1_done'}
								<div class="flex items-center justify-center gap-1.5 border-b border-blue-200 bg-blue-50 px-3 py-1 dark:border-blue-800 dark:bg-blue-900/30">
									<span class="relative flex h-2 w-2">
										<span class="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
									</span>
									<span class="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Leg 1 Selesai</span>
								</div>
							{:else if mStatus === 'ready'}
								<div class="flex items-center justify-center gap-1.5 border-b border-green-200 bg-green-50 px-3 py-1 dark:border-green-800 dark:bg-green-900/30">
									<span class="relative flex h-2 w-2">
										<span class="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
									</span>
									<span class="text-[10px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">Siap</span>
								</div>
							{/if}
							<!-- Participant 1 -->
							<div
								class="flex items-center gap-3 border-b px-3 py-2.5 text-sm
									{mStatus === 'now_playing' ? 'border-amber-100 dark:border-amber-900/30' : 'border-gray-200 dark:border-gray-600'}
									{match.winnerId === match.participant1Id ? 'bg-green-50 font-bold text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-50 dark:bg-gray-700'}"
							>
								{#if getAvatar(match.participant1Id)}
									<img src={getAvatar(match.participant1Id)} alt="" class="h-10 w-10 rounded-full object-cover" />
								{:else if match.participant1Id}
									<div class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-300">
										{getName(match.participant1Id).charAt(0).toUpperCase()}
									</div>
								{:else}
									<div class="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-600"></div>
								{/if}
								<span class="flex-1 truncate">{getName(match.participant1Id)}</span>
								{#if match.score1 !== null && format === 'home_away'}
									<span class="font-mono text-xs text-gray-400">{match.score1}{#if match.score1Leg2 !== null}-{match.score1Leg2}{/if}</span>
									{#if match.score1Leg2 !== null}
										<span class="font-mono text-xs font-bold">{(match.score1 ?? 0) + (match.score1Leg2 ?? 0)}</span>
									{/if}
								{:else if match.score1 !== null}
									<span class="font-mono text-xs">{match.score1}</span>
								{/if}
							</div>
							<!-- Participant 2 -->
							<div
								class="flex items-center gap-3 px-3 py-2.5 text-sm
									{match.winnerId === match.participant2Id ? 'bg-green-50 font-bold text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-50 dark:bg-gray-700'}"
							>
								{#if getAvatar(match.participant2Id)}
									<img src={getAvatar(match.participant2Id)} alt="" class="h-10 w-10 rounded-full object-cover" />
								{:else if match.participant2Id}
									<div class="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-sm font-medium text-orange-600 dark:bg-orange-900 dark:text-orange-300">
										{getName(match.participant2Id).charAt(0).toUpperCase()}
									</div>
								{:else}
									<div class="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-600"></div>
								{/if}
								<span class="flex-1 truncate">{getName(match.participant2Id)}</span>
								{#if match.score2 !== null && format === 'home_away'}
									<span class="font-mono text-xs text-gray-400">{match.score2}{#if match.score2Leg2 !== null}-{match.score2Leg2}{/if}</span>
									{#if match.score2Leg2 !== null}
										<span class="font-mono text-xs font-bold">{(match.score2 ?? 0) + (match.score2Leg2 ?? 0)}</span>
									{/if}
								{:else if match.score2 !== null}
									<span class="font-mono text-xs">{match.score2}</span>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>

<!-- Score modal -->
{#if scoringMatch}
	{@const match = matches.find((m) => m.id === scoringMatch)}
	{@const leg = match ? currentLeg(match) : 1}
	{@const isHomeAway = format === 'home_away'}
	{@const aggInvalid = isHomeAway && leg === 2 && match ? ((match.score1 ?? 0) + s1) === ((match.score2 ?? 0) + s2) : false}
	{@const singleInvalid = !isHomeAway && s1 === s2}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={() => scoringMatch = null} role="dialog">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="w-96 rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800" onclick={(e) => e.stopPropagation()} role="document">
			<h3 class="mb-4 text-center text-lg font-semibold">
				{isHomeAway ? `Input Skor Leg ${leg}` : 'Input Skor'}
			</h3>
			{#if isHomeAway}
				<p class="mb-3 text-center text-xs text-gray-500">
					{leg === 1 ? `Home: ${getName(match?.participant1Id ?? null)}` : `Home: ${getName(match?.participant2Id ?? null)}`}
				</p>
			{/if}
			{#if isHomeAway && leg === 2 && match}
				<div class="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-center text-xs dark:bg-gray-700/50">
					<span class="text-gray-500">Leg 1:</span>
					<span class="font-mono font-bold"> {match.score1} - {match.score2}</span>
				</div>
			{/if}
			{#if match}
				<div class="space-y-3">
					<div class="flex items-center gap-3">
						{#if getAvatar(match.participant1Id)}
							<img src={getAvatar(match.participant1Id)} alt="" class="h-10 w-10 rounded-full object-cover" />
						{:else}
							<div class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-300">
								{getName(match.participant1Id).charAt(0).toUpperCase()}
							</div>
						{/if}
						<span class="flex-1 font-medium">{getName(match.participant1Id)}</span>
						<input
							type="number"
							min="0"
							bind:value={s1}
							class="w-20 rounded border border-gray-300 px-3 py-1 text-center dark:border-gray-600 dark:bg-gray-700"
						/>
					</div>
					<div class="flex items-center gap-3">
						{#if getAvatar(match.participant2Id)}
							<img src={getAvatar(match.participant2Id)} alt="" class="h-10 w-10 rounded-full object-cover" />
						{:else}
							<div class="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-sm font-medium text-orange-600 dark:bg-orange-900 dark:text-orange-300">
								{getName(match.participant2Id).charAt(0).toUpperCase()}
							</div>
						{/if}
						<span class="flex-1 font-medium">{getName(match.participant2Id)}</span>
						<input
							type="number"
							min="0"
							bind:value={s2}
							class="w-20 rounded border border-gray-300 px-3 py-1 text-center dark:border-gray-600 dark:bg-gray-700"
						/>
					</div>
					{#if singleInvalid}
						<p class="text-center text-xs text-red-500">Skor tidak boleh seri</p>
					{/if}
					{#if aggInvalid}
						<p class="text-center text-xs text-red-500">Skor agregat tidak boleh seri ({(match.score1 ?? 0) + s1} - {(match.score2 ?? 0) + s2})</p>
					{/if}
				</div>
				<div class="mt-4 flex gap-3">
					<button
						onclick={() => scoringMatch = null}
						class="flex-1 rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
					>
						Batal
					</button>
					<button
						onclick={confirmScore}
						disabled={singleInvalid || aggInvalid}
						class="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
					>
						Simpan
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	@keyframes pulse-subtle {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.85; }
	}
	:global(.animate-pulse-subtle) {
		animation: pulse-subtle 2s ease-in-out infinite;
	}
</style>
