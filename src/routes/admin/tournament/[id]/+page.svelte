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

	type Participant = typeof participantList[0];

	function buildBracketSlots(participants: Participant[]): (Participant | null)[] {
		const count = participants.length;
		if (count < 2) return [];
		let totalSlots = 1;
		while (totalSlots < count) totalSlots *= 2;
		const slots: (Participant | null)[] = new Array(totalSlots).fill(null);
		for (const p of participants) {
			const slotIndex = (p.seed ?? 999) - 1;
			if (slotIndex >= 0 && slotIndex < totalSlots) {
				slots[slotIndex] = p;
			}
		}
		const placed = new Set(participants.filter(p => {
			const idx = (p.seed ?? 999) - 1;
			return idx >= 0 && idx < totalSlots;
		}).map(p => p.id));
		let nextEmpty = 0;
		for (const p of participants) {
			if (!placed.has(p.id)) {
				while (nextEmpty < totalSlots && slots[nextEmpty] !== null) nextEmpty++;
				if (nextEmpty < totalSlots) slots[nextEmpty] = p;
			}
		}
		return slots;
	}

	let bracketSlots = $state<(Participant | null)[]>(buildBracketSlots(participantList));

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
			bracketSlots = rebuildSlotsKeepingArrangement(bracketSlots, participantList);
			newParticipant = '';
			selectedMaster = null;
			suggestions = [];
		}
		adding = false;
	}

	function rebuildSlotsKeepingArrangement(currentSlots: (Participant | null)[], participants: Participant[]): (Participant | null)[] {
		const count = participants.length;
		if (count < 2) return [];
		let totalSlots = 1;
		while (totalSlots < count) totalSlots *= 2;

		const newSlots: (Participant | null)[] = new Array(totalSlots).fill(null);
		const placed = new Set<string>();

		for (let i = 0; i < Math.min(currentSlots.length, totalSlots); i++) {
			const p = currentSlots[i];
			if (p && participants.some(pp => pp.id === p.id)) {
				newSlots[i] = participants.find(pp => pp.id === p.id)!;
				placed.add(p.id);
			}
		}

		let nextEmpty = 0;
		for (const p of participants) {
			if (!placed.has(p.id)) {
				while (nextEmpty < totalSlots && newSlots[nextEmpty] !== null) nextEmpty++;
				if (nextEmpty < totalSlots) {
					newSlots[nextEmpty] = p;
				}
			}
		}
		return newSlots;
	}

	async function removeParticipant(id: string) {
		await fetch(`/api/tournaments/${tournament.id}/participants`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ participantId: id })
		});
		participantList = participantList.filter((p) => p.id !== id);
		participantList = participantList.map((p, i) => ({ ...p, seed: i + 1 }));
		bracketSlots = rebuildSlotsKeepingArrangement(bracketSlots, participantList);
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
			const newName = editedParticipantName.trim();
			participantList = participantList.map((p) =>
				p.id === id ? { ...p, name: newName } : p
			);
			bracketSlots = bracketSlots.map((s) =>
				s?.id === id ? { ...s, name: newName } : s
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
				bracketSlots = bracketSlots.map((s) =>
					s?.id === id ? { ...s, avatar } : s
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
			bracketSlots = bracketSlots.map((s) =>
				s?.id === id ? { ...s, avatar: null } : s
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

	let draftBracketEl = $state<HTMLDivElement | null>(null);
	let draftMatchEls: Record<string, HTMLElement> = {};
	interface DraftLine { x1: number; y1: number; x2: number; y2: number }
	let draftLines = $state<DraftLine[]>([]);
	let draftSvgW = $state(0);
	let draftSvgH = $state(0);

	function trackDraftMatch(node: HTMLElement, key: string) {
		draftMatchEls[key] = node;
		return { destroy() { delete draftMatchEls[key]; } };
	}

	function calcDraftConnectors() {
		if (!draftBracketEl) return;
		const cr = draftBracketEl.getBoundingClientRect();
		const lines: DraftLine[] = [];
		const preview = bracketPreview();
		if (preview.totalRounds < 2) { draftLines = []; return; }
		for (let r = 0; r < preview.totalRounds - 1; r++) {
			const curCount = preview.totalSlots / Math.pow(2, r + 1);
			const nxtCount = curCount / 2;
			for (let p = 0; p < curCount; p += 2) {
				const el1 = draftMatchEls[`r${r}-m${p}`];
				const el2 = draftMatchEls[`r${r}-m${p + 1}`];
				const elN = draftMatchEls[`r${r + 1}-m${Math.floor(p / 2)}`];
				if (!el1 || !elN) continue;
				const r1 = el1.getBoundingClientRect();
				const rn = elN.getBoundingClientRect();
				const x1 = r1.right - cr.left;
				const y1 = r1.top + r1.height / 2 - cr.top;
				const xn = rn.left - cr.left;
				const yn = rn.top + rn.height / 2 - cr.top;
				const mx = (x1 + xn) / 2;
				lines.push({ x1, y1, x2: mx, y2: y1 });
				if (el2) {
					const r2 = el2.getBoundingClientRect();
					const y2 = r2.top + r2.height / 2 - cr.top;
					lines.push({ x1: r2.right - cr.left, y1: y2, x2: mx, y2 });
					lines.push({ x1: mx, y1, x2: mx, y2 });
				}
				lines.push({ x1: mx, y1: yn, x2: xn, y2: yn });
			}
		}
		draftSvgW = draftBracketEl.scrollWidth;
		draftSvgH = draftBracketEl.scrollHeight;
		draftLines = lines;
	}

	$effect(() => {
		const _ = [bracketSlots.length, participantList.length];
		const raf = requestAnimationFrame(calcDraftConnectors);
		return () => cancelAnimationFrame(raf);
	});

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

		const newSlots = [...bracketSlots];
		[newSlots[bracketDragSlot], newSlots[slotIndex]] = [newSlots[slotIndex], newSlots[bracketDragSlot]];
		bracketSlots = newSlots;

		const seedUpdates: { id: string; seed: number }[] = [];
		for (let i = 0; i < newSlots.length; i++) {
			if (newSlots[i]) {
				newSlots[i]!.seed = i + 1;
				seedUpdates.push({ id: newSlots[i]!.id, seed: i + 1 });
			}
		}
		participantList = newSlots.filter((s): s is Participant => s !== null);

		await fetch(`/api/tournaments/${tournament.id}/reorder-slots`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ slots: seedUpdates })
		});

		bracketDragSlot = null;
		bracketDragOverSlot = null;
	}

	async function shuffleBracketSlots() {
		const totalSlots = bracketSlots.length;
		const numMatches = totalSlots / 2;
		const numByes = totalSlots - participantList.length;

		const players = participantList.slice();
		for (let i = players.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[players[i], players[j]] = [players[j], players[i]];
		}

		const newSlots: (Participant | null)[] = new Array(totalSlots).fill(null);

		if (numByes <= numMatches) {
			const matchIndices = Array.from({ length: numMatches }, (_, i) => i);
			for (let i = matchIndices.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[matchIndices[i], matchIndices[j]] = [matchIndices[j], matchIndices[i]];
			}
			const byeMatches = new Set(matchIndices.slice(0, numByes));

			let pi = 0;
			for (let m = 0; m < numMatches; m++) {
				if (byeMatches.has(m)) {
					const byePos = Math.random() < 0.5 ? 0 : 1;
					newSlots[m * 2 + byePos] = null;
					newSlots[m * 2 + (1 - byePos)] = players[pi++];
				} else {
					newSlots[m * 2] = players[pi++];
					newSlots[m * 2 + 1] = players[pi++];
				}
			}
		} else {
			const matchIndices = Array.from({ length: numMatches }, (_, i) => i);
			for (let i = matchIndices.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[matchIndices[i], matchIndices[j]] = [matchIndices[j], matchIndices[i]];
			}
			let pi = 0;
			for (let mi = 0; mi < numMatches; mi++) {
				const m = matchIndices[mi];
				if (pi < players.length) {
					const byePos = Math.random() < 0.5 ? 0 : 1;
					newSlots[m * 2 + (1 - byePos)] = players[pi++];
				}
			}
		}

		const seedUpdates: { id: string; seed: number }[] = [];
		for (let i = 0; i < newSlots.length; i++) {
			if (newSlots[i]) {
				newSlots[i]!.seed = i + 1;
				seedUpdates.push({ id: newSlots[i]!.id, seed: i + 1 });
			}
		}

		bracketSlots = newSlots;
		participantList = newSlots.filter((s): s is Participant => s !== null);

		await fetch(`/api/tournaments/${tournament.id}/reorder-slots`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ slots: seedUpdates })
		});
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

	async function submitScore(matchId: string, score1: number, score2: number, leg?: number) {
		const res = await fetch(`/api/tournaments/${tournament.id}/score`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ matchId, score1, score2, leg })
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

	const bracketPreview = $derived(() => {
		if (bracketSlots.length === 0) return { pairs: [] as { p1: Participant | null; p2: Participant | null }[], totalSlots: 0, totalRounds: 0 };
		const totalSlots = bracketSlots.length;
		const totalRounds = Math.log2(totalSlots);
		const matchCount = totalSlots / 2;
		const pairs: { p1: Participant | null; p2: Participant | null }[] = [];
		for (let i = 0; i < matchCount; i++) {
			pairs.push({
				p1: bracketSlots[i * 2] ?? null,
				p2: bracketSlots[i * 2 + 1] ?? null
			});
		}
		return { pairs, totalSlots, totalRounds };
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

		{#if tournament.format === 'home_away'}
			<span class="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900 dark:text-purple-300">Home & Away</span>
		{/if}

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
					<div class="flex items-center gap-3">
						<p class="text-xs text-gray-500">Drag & drop peserta antar slot untuk tukar posisi</p>
						{#if tournament.status === 'draft' && participantList.length >= 2}
							<button
								type="button"
								onclick={shuffleBracketSlots}
								class="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
							>
								Acak Posisi
							</button>
						{/if}
					</div>
				</div>

				<div class="overflow-x-auto">
					<div class="relative" bind:this={draftBracketEl} style="min-width: max-content;">
						{#if draftLines.length > 0}
							<svg
								width={draftSvgW}
								height={draftSvgH}
								class="pointer-events-none absolute left-0 top-0 text-gray-300 dark:text-gray-600"
							>
								{#each draftLines as l}
									<line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="currentColor" stroke-width="2" />
								{/each}
							</svg>
						{/if}
					<div class="relative flex gap-12" style="min-width: max-content;">
						<!-- Round 1 (with drag & drop) -->
						<div class="flex flex-col">
							<h3 class="mb-4 text-center text-sm font-medium text-gray-500">Round 1</h3>
							<div class="flex flex-1 flex-col justify-around gap-4">
							{#each preview.pairs as pair, i}
								<div class="w-72 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600" use:trackDraftMatch={`r0-m${i}`}>
									<!-- Participant 1 -->
									<div
										class="flex items-center gap-2 border-b border-gray-200 px-3 py-2.5 text-sm dark:border-gray-600
											{bracketDragOverSlot === i * 2 ? 'ring-2 ring-inset ring-blue-400 bg-blue-50 dark:bg-blue-900/20' : pair.p1 ? 'bg-white dark:bg-gray-700' : 'bg-gray-50 dark:bg-gray-750'}
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
											<span class="italic text-gray-400">BYE</span>
										{/if}
									</div>
									<!-- Participant 2 -->
									<div
										class="flex items-center gap-2 px-3 py-2.5 text-sm
											{bracketDragOverSlot === i * 2 + 1 ? 'ring-2 ring-inset ring-blue-400 bg-blue-50 dark:bg-blue-900/20' : pair.p2 ? 'bg-white dark:bg-gray-700' : 'bg-gray-50 dark:bg-gray-750'}
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
											<span class="italic text-gray-400">BYE</span>
										{/if}
									</div>
								</div>
							{/each}
							</div>
						</div>

						<!-- Later rounds (read-only placeholders) -->
						{#each { length: preview.totalRounds - 1 } as _, r}
							{@const roundNum = r + 2}
							{@const matchCount = preview.totalSlots / Math.pow(2, roundNum)}
							<div class="flex flex-col">
								<h3 class="mb-4 text-center text-sm font-medium text-gray-500">
									{roundNum === preview.totalRounds ? 'Final' : roundNum === preview.totalRounds - 1 ? 'Semi Final' : roundNum === preview.totalRounds - 2 && preview.totalRounds > 3 ? 'Quarter Final' : `Round ${roundNum}`}
								</h3>
								<div class="flex flex-1 flex-col justify-around">
								{#each { length: matchCount } as _m, mi}
									<div class="w-56 overflow-hidden rounded-lg border border-dashed border-gray-300 dark:border-gray-600" use:trackDraftMatch={`r${r + 1}-m${mi}`}>
										<div class="border-b border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 text-sm italic text-gray-400 dark:border-gray-600 dark:bg-gray-750">
											TBD
										</div>
										<div class="bg-gray-50 px-3 py-2.5 text-sm italic text-gray-400 dark:bg-gray-750">
											TBD
										</div>
									</div>
								{/each}
								</div>
							</div>
						{/each}
					</div>
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
			format={tournament.format}
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
