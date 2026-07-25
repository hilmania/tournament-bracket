<script lang="ts">
	import type { PageData } from './$types';
	import BracketView from '$lib/components/BracketView.svelte';

	let { data }: { data: PageData } = $props();

	type MasterEntry = { id: string; name: string; avatar: string | null };

	let newParticipant = $state('');
	let adding = $state(false);
	let starting = $state(false);
	let editingName = $state(false);
	let editedName = $state('');
	let editingParticipant = $state<string | null>(null);
	let editedParticipantName = $state('');

	let suggestions = $state<MasterEntry[]>([]);
	let showSuggestions = $state(false);
	let selectedMaster = $state<MasterEntry | null>(null);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	let participantList = $state(data.participants.slice());
	let matchList = $state(data.matches.slice());
	let tournament = $state(structuredClone(data.tournament));
	let resetting = $state(false);

	async function saveTournamentName() {
		if (!editedName.trim() || editedName.trim() === tournament.name) {
			editingName = false;
			return;
		}
		const res = await fetch(`/api/tournaments/${tournament.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: editedName.trim() })
		});
		if (res.ok) {
			tournament.name = editedName.trim();
		}
		editingName = false;
	}

	async function searchMaster(query: string) {
		if (query.trim().length === 0) { suggestions = []; return; }
		const res = await fetch(`/api/master-participants?q=${encodeURIComponent(query.trim())}`);
		if (res.ok) {
			const all = await res.json() as MasterEntry[];
			const usedIds = new Set(participantList.map((p) => p.masterParticipantId));
			suggestions = all.filter((m) => !usedIds.has(m.id));
		}
	}

	function onInputChange(value: string) {
		newParticipant = value;
		selectedMaster = null;
		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => searchMaster(value), 200);
		showSuggestions = true;
	}

	function pickSuggestion(master: MasterEntry) {
		selectedMaster = master;
		newParticipant = master.name;
		showSuggestions = false;
		suggestions = [];
	}

	async function addParticipant() {
		if (!newParticipant.trim()) return;
		adding = true;
		const body: Record<string, string | null> = { name: newParticipant.trim() };
		if (selectedMaster) {
			body.masterParticipantId = selectedMaster.id;
			body.avatar = selectedMaster.avatar;
		}
		const res = await fetch(`/api/tournaments/${tournament.id}/participants`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (res.ok) {
			const p = await res.json() as typeof participantList[0];
			participantList = [...participantList, p];
			newParticipant = '';
			selectedMaster = null;
			suggestions = [];
		}
		adding = false;
	}

	async function removeParticipant(id: string) {
		await fetch(`/api/tournaments/${tournament.id}/participants`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ participantId: id })
		});
		participantList = participantList.filter((p) => p.id !== id);
		participantList = participantList.map((p, i) => ({ ...p, seed: i + 1 }));
	}

	async function saveParticipantName(id: string) {
		if (!editedParticipantName.trim()) {
			editingParticipant = null;
			return;
		}
		const res = await fetch(`/api/tournaments/${tournament.id}/participants`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ participantId: id, name: editedParticipantName.trim() })
		});
		if (res.ok) {
			participantList = participantList.map((p) =>
				p.id === id ? { ...p, name: editedParticipantName.trim() } : p
			);
		}
		editingParticipant = null;
	}

	async function uploadAvatar(id: string, event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (file.size > 500_000) {
			alert('Ukuran foto maksimal 500KB');
			return;
		}

		const reader = new FileReader();
		reader.onload = async () => {
			const avatar = reader.result as string;
			const res = await fetch(`/api/tournaments/${tournament.id}/participants`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ participantId: id, avatar })
			});
			if (res.ok) {
				participantList = participantList.map((p) =>
					p.id === id ? { ...p, avatar } : p
				);
			}
		};
		reader.readAsDataURL(file);
	}

	async function removeAvatar(id: string) {
		const res = await fetch(`/api/tournaments/${tournament.id}/participants`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ participantId: id, avatar: null })
		});
		if (res.ok) {
			participantList = participantList.map((p) =>
				p.id === id ? { ...p, avatar: null } : p
			);
		}
	}

	async function moveParticipant(index: number, direction: 'up' | 'down') {
		const target = direction === 'up' ? index - 1 : index + 1;
		if (target < 0 || target >= participantList.length) return;

		const newList = [...participantList];
		[newList[index], newList[target]] = [newList[target], newList[index]];
		newList.forEach((p, i) => (p.seed = i + 1));
		participantList = newList;

		await fetch(`/api/tournaments/${tournament.id}/reorder`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ order: participantList.map((p) => p.id) })
		});
	}

	let dragIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);
	let bracketDragSlot = $state<number | null>(null);
	let bracketDragOverSlot = $state<number | null>(null);

	function handleDragStart(index: number) {
		dragIndex = index;
	}

	function handleDragOver(event: DragEvent, index: number) {
		event.preventDefault();
		dragOverIndex = index;
	}

	async function handleDrop(index: number) {
		if (dragIndex === null || dragIndex === index) {
			dragIndex = null;
			dragOverIndex = null;
			return;
		}

		const newList = [...participantList];
		const [moved] = newList.splice(dragIndex, 1);
		newList.splice(index, 0, moved);
		newList.forEach((p, i) => (p.seed = i + 1));
		participantList = newList;
		dragIndex = null;
		dragOverIndex = null;

		await fetch(`/api/tournaments/${tournament.id}/reorder`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ order: participantList.map((p) => p.id) })
		});
	}

	function bracketSlotDragStart(slotIndex: number) {
		bracketDragSlot = slotIndex;
	}

	function bracketSlotDragOver(event: DragEvent, slotIndex: number) {
		event.preventDefault();
		bracketDragOverSlot = slotIndex;
	}

	async function bracketSlotDrop(slotIndex: number) {
		if (bracketDragSlot === null || bracketDragSlot === slotIndex) {
			bracketDragSlot = null;
			bracketDragOverSlot = null;
			return;
		}
		const preview = bracketPreview();
		const fromParticipant = preview.slots[bracketDragSlot];
		const toParticipant = preview.slots[slotIndex];
		if (!fromParticipant && !toParticipant) {
			bracketDragSlot = null;
			bracketDragOverSlot = null;
			return;
		}
		const fromSeedIdx = fromParticipant ? sortedParticipants.indexOf(fromParticipant) : -1;
		const toSeedIdx = toParticipant ? sortedParticipants.indexOf(toParticipant) : -1;
		if (fromSeedIdx === -1 && toSeedIdx === -1) {
			bracketDragSlot = null;
			bracketDragOverSlot = null;
			return;
		}
		if (fromSeedIdx >= 0 && toSeedIdx >= 0) {
			const newList = [...participantList];
			const fi = newList.findIndex(p => p.id === fromParticipant!.id);
			const ti = newList.findIndex(p => p.id === toParticipant!.id);
			[newList[fi], newList[ti]] = [newList[ti], newList[fi]];
			newList.forEach((p, i) => (p.seed = i + 1));
			participantList = newList;
			await fetch(`/api/tournaments/${tournament.id}/reorder`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ order: participantList.map((p) => p.id) })
			});
		}
		bracketDragSlot = null;
		bracketDragOverSlot = null;
	}

	async function startTournament() {
		if (participantList.length < 2) return;
		starting = true;
		const res = await fetch(`/api/tournaments/${tournament.id}/start`, { method: 'POST' });
		if (res.ok) {
			window.location.reload();
		} else {
			const err = await res.json() as { error: string };
			alert(err.error);
		}
		starting = false;
	}

	async function resetBracket() {
		if (!confirm('Reset bracket? Semua hasil pertandingan akan dihapus dan turnamen kembali ke draft.')) return;
		resetting = true;
		const res = await fetch(`/api/tournaments/${tournament.id}/reset`, { method: 'POST' });
		if (res.ok) {
			window.location.reload();
		} else {
			const err = await res.json() as { error: string };
			alert(err.error);
		}
		resetting = false;
	}

	async function submitScore(matchId: string, score1: number, score2: number) {
		const res = await fetch(`/api/tournaments/${tournament.id}/score`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ matchId, score1, score2 })
		});
		if (res.ok) {
			window.location.reload();
		} else {
			const err = await res.json() as { error: string };
			alert(err.error);
		}
	}

	async function toggleNowPlaying(matchId: string) {
		const res = await fetch(`/api/tournaments/${tournament.id}/now-playing`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ matchId })
		});
		if (res.ok) {
			const { nowPlaying, startedAt } = await res.json() as { nowPlaying: boolean; startedAt: string };
			matchList = matchList.map((m) => ({
				...m,
				nowPlaying: m.id === matchId ? nowPlaying : false,
				startedAt: m.id === matchId && nowPlaying ? startedAt : m.startedAt
			}));
		}
	}

	const sortedParticipants = $derived(
		[...participantList].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))
	);

	function seedPosition(seed: number, size: number): number {
		if (size <= 1) return 0;
		if (seed < 2) return seed * (size - 1);
		const half = Math.floor(size / 2);
		const isOdd = seed % 2 === 1;
		return isOdd
			? half + seedPosition(Math.floor(seed / 2), half)
			: seedPosition(Math.floor(seed / 2), half);
	}

	const bracketPreview = $derived(() => {
		if (sortedParticipants.length < 2) return { pairs: [], slots: [] as (typeof sortedParticipants[0] | null)[], totalSlots: 0, totalRounds: 0 };
		const count = sortedParticipants.length;
		let totalSlots = 1;
		while (totalSlots < count) totalSlots *= 2;
		const totalRounds = Math.log2(totalSlots);
		const slots: (typeof sortedParticipants[0] | null)[] = new Array(totalSlots).fill(null);
		for (let i = 0; i < sortedParticipants.length; i++) {
			slots[seedPosition(i, totalSlots)] = sortedParticipants[i];
		}
		const matchCount = totalSlots / 2;
		const pairs: { p1: typeof sortedParticipants[0] | null; p2: typeof sortedParticipants[0] | null }[] = [];
		for (let i = 0; i < matchCount; i++) {
			pairs.push({
				p1: slots[i * 2] ?? null,
				p2: slots[i * 2 + 1] ?? null
			});
		}
		return { pairs, slots, totalSlots, totalRounds };
	});
</script>

<div class="mx-auto max-w-7xl px-4 py-8">
	<!-- Header with editable name -->
	<div class="mb-6 flex items-center gap-4">
		<a href="/admin" class="text-blue-600 hover:underline">&larr; Kembali</a>

		{#if editingName}
			<form onsubmit={(e) => { e.preventDefault(); saveTournamentName(); }} class="flex items-center gap-2">
				<input
					type="text"
					bind:value={editedName}
					class="rounded-lg border border-blue-400 px-3 py-1 text-2xl font-bold focus:outline-none dark:border-blue-600 dark:bg-gray-700"
					autofocus
				/>
				<button type="submit" class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700">Simpan</button>
				<button type="button" onclick={() => editingName = false} class="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">Batal</button>
			</form>
		{:else}
			<h1 class="text-2xl font-bold">{tournament.name}</h1>
			<button
				onclick={() => { editingName = true; editedName = tournament.name; }}
				class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
				title="Ubah nama turnamen"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
			</button>
		{/if}

		<span
			class="rounded-full px-3 py-1 text-xs font-medium
				{tournament.status === 'draft' ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' : ''}
				{tournament.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : ''}
				{tournament.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : ''}"
		>
			{tournament.status === 'draft' ? 'Draft' : tournament.status === 'in_progress' ? 'Berlangsung' : 'Selesai'}
		</span>

		<span class="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900 dark:text-red-300">Admin</span>

		{#if tournament.status !== 'draft'}
			<a
				href="/tournament/{tournament.id}"
				class="ml-auto rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
			>
				Lihat Halaman Publik
			</a>
		{/if}
	</div>

	{#if tournament.status === 'draft'}
		<!-- Add Participant -->
		<div class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
			<h2 class="mb-4 text-lg font-semibold">Peserta ({participantList.length})</h2>
			<form onsubmit={(e) => { e.preventDefault(); addParticipant(); }} class="flex gap-3">
				<div class="relative flex-1">
					<input
						type="text"
						value={newParticipant}
						oninput={(e) => onInputChange((e.target as HTMLInputElement).value)}
						onfocus={() => { if (suggestions.length > 0) showSuggestions = true; }}
						onblur={() => setTimeout(() => showSuggestions = false, 200)}
						placeholder="Ketik nama atau pilih dari master..."
						class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
						autocomplete="off"
					/>
					{#if selectedMaster}
						<span class="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
							dari master
						</span>
					{/if}
					{#if showSuggestions && suggestions.length > 0}
						<div class="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
							<div class="max-h-48 overflow-y-auto">
								{#each suggestions as s}
									<button
										type="button"
										class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-blue-50 dark:hover:bg-gray-700"
										onmousedown={() => pickSuggestion(s)}
									>
										{#if s.avatar}
											<img src={s.avatar} alt="" class="h-8 w-8 rounded-full object-cover" />
										{:else}
											<div class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-500 dark:bg-gray-600">
												{s.name.charAt(0).toUpperCase()}
											</div>
										{/if}
										<span>{s.name}</span>
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
				<button
					type="submit"
					disabled={adding || !newParticipant.trim()}
					class="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
				>
					Tambah
				</button>
			</form>
		</div>

		<!-- Interactive Bracket Diagram -->
		{#if bracketPreview().pairs.length > 0}
			{@const preview = bracketPreview()}
			<div class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-lg font-semibold">Bagan Bracket</h2>
					<p class="text-xs text-gray-500">Drag & drop peserta antar slot untuk tukar posisi</p>
				</div>

				<div class="overflow-x-auto">
					<div class="flex gap-12" style="min-width: max-content;">
						<!-- Round 1 (with drag & drop) -->
						<div class="flex flex-col gap-6">
							<h3 class="text-center text-sm font-medium text-gray-500">Round 1</h3>
							{#each preview.pairs as pair, i}
								<div class="w-72 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600">
									<!-- Participant 1 -->
									<div
										class="flex items-center gap-2 border-b border-gray-200 px-3 py-2.5 text-sm dark:border-gray-600
											{bracketDragOverSlot === i * 2 ? 'ring-2 ring-inset ring-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-700'}
											{bracketDragSlot === i * 2 ? 'opacity-40' : ''}"
										draggable={!!pair.p1}
										ondragstart={() => bracketSlotDragStart(i * 2)}
										ondragover={(e: DragEvent) => bracketSlotDragOver(e, i * 2)}
										ondrop={() => bracketSlotDrop(i * 2)}
										ondragend={() => { bracketDragSlot = null; bracketDragOverSlot = null; }}
										role="listitem"
									>
										{#if pair.p1}
											<span class="cursor-grab text-gray-300 active:cursor-grabbing">
												<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm8-8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>
											</span>
											<span class="w-5 text-center text-[10px] font-medium text-gray-400">
												{sortedParticipants.indexOf(pair.p1) + 1}
											</span>
											{#if pair.p1.avatar}
												<img src={pair.p1.avatar} alt="" class="h-8 w-8 rounded-full object-cover" />
											{:else}
												<div class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-300">
													{pair.p1.name.charAt(0).toUpperCase()}
												</div>
											{/if}
											<span class="flex-1 truncate">{pair.p1.name}</span>
											<button
												onclick={() => removeParticipant(pair.p1!.id)}
												class="rounded p-0.5 text-gray-300 hover:text-red-500"
												title="Hapus"
											>
												<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
											</button>
										{:else}
											<span class="pl-6 italic text-gray-400">BYE</span>
										{/if}
									</div>
									<!-- Participant 2 -->
									<div
										class="flex items-center gap-2 px-3 py-2.5 text-sm
											{bracketDragOverSlot === i * 2 + 1 ? 'ring-2 ring-inset ring-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-700'}
											{bracketDragSlot === i * 2 + 1 ? 'opacity-40' : ''}"
										draggable={!!pair.p2}
										ondragstart={() => bracketSlotDragStart(i * 2 + 1)}
										ondragover={(e: DragEvent) => bracketSlotDragOver(e, i * 2 + 1)}
										ondrop={() => bracketSlotDrop(i * 2 + 1)}
										ondragend={() => { bracketDragSlot = null; bracketDragOverSlot = null; }}
										role="listitem"
									>
										{#if pair.p2}
											<span class="cursor-grab text-gray-300 active:cursor-grabbing">
												<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm8-8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>
											</span>
											<span class="w-5 text-center text-[10px] font-medium text-gray-400">
												{sortedParticipants.indexOf(pair.p2) + 1}
											</span>
											{#if pair.p2.avatar}
												<img src={pair.p2.avatar} alt="" class="h-8 w-8 rounded-full object-cover" />
											{:else}
												<div class="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-xs font-medium text-orange-600 dark:bg-orange-900 dark:text-orange-300">
													{pair.p2.name.charAt(0).toUpperCase()}
												</div>
											{/if}
											<span class="flex-1 truncate">{pair.p2.name}</span>
											<button
												onclick={() => removeParticipant(pair.p2!.id)}
												class="rounded p-0.5 text-gray-300 hover:text-red-500"
												title="Hapus"
											>
												<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
											</button>
										{:else}
											<span class="pl-6 italic text-gray-400">BYE</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>

						<!-- Later rounds (read-only placeholders) -->
						{#each { length: preview.totalRounds - 1 } as _, r}
							{@const roundNum = r + 2}
							{@const matchCount = preview.totalSlots / Math.pow(2, roundNum)}
							<div class="flex flex-col" style="justify-content: space-around;">
								<h3 class="mb-4 text-center text-sm font-medium text-gray-500">
									{roundNum === preview.totalRounds ? 'Final' : roundNum === preview.totalRounds - 1 ? 'Semi Final' : roundNum === preview.totalRounds - 2 && preview.totalRounds > 3 ? 'Quarter Final' : `Round ${roundNum}`}
								</h3>
								{#each { length: matchCount } as _m}
									<div class="my-2 w-56 overflow-hidden rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
										<div class="border-b border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 text-sm italic text-gray-400 dark:border-gray-600 dark:bg-gray-750">
											TBD
										</div>
										<div class="bg-gray-50 px-3 py-2.5 text-sm italic text-gray-400 dark:bg-gray-750">
											TBD
										</div>
									</div>
								{/each}
							</div>
						{/each}
					</div>
				</div>

				<div class="mt-6">
					{#if participantList.length >= 2}
						<button
							onclick={startTournament}
							disabled={starting}
							class="w-full rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-50"
						>
							{starting ? 'Memulai...' : `Mulai Turnamen (${participantList.length} peserta)`}
						</button>
					{:else}
						<p class="text-center text-sm text-gray-500">Minimal 2 peserta untuk memulai turnamen</p>
					{/if}
				</div>
			</div>
		{:else if participantList.length < 2}
			<div class="mb-6 rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<p class="text-sm text-gray-500">Tambahkan minimal 2 peserta untuk melihat bagan bracket</p>
			</div>
		{/if}
	{:else}
		<BracketView
			matches={matchList}
			participants={participantList}
			status={tournament.status}
			admin={true}
			onScore={submitScore}
			onNowPlaying={toggleNowPlaying}
		/>
		<div class="mt-6 flex justify-end">
			<button
				onclick={resetBracket}
				disabled={resetting}
				class="rounded-lg border-2 border-red-300 px-6 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
			>
				{resetting ? 'Mereset...' : 'Reset Bracket'}
			</button>
		</div>
	{/if}
</div>
