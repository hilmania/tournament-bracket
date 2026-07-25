<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let masterList = $state(data.masterParticipants.slice());
	let newName = $state('');
	let adding = $state(false);
	let editingId = $state<string | null>(null);
	let editedName = $state('');
	let search = $state('');

	const filtered = $derived(
		search.trim()
			? masterList.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
			: masterList
	);

	async function addMaster() {
		if (!newName.trim()) return;
		adding = true;
		const res = await fetch('/api/master-participants', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: newName.trim() })
		});
		if (res.ok) {
			const p = await res.json() as typeof masterList[0];
			masterList = [p, ...masterList];
			newName = '';
		}
		adding = false;
	}

	async function saveName(id: string) {
		if (!editedName.trim()) { editingId = null; return; }
		const res = await fetch('/api/master-participants', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, name: editedName.trim() })
		});
		if (res.ok) {
			masterList = masterList.map((p) => p.id === id ? { ...p, name: editedName.trim() } : p);
		}
		editingId = null;
	}

	async function uploadAvatar(id: string, event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (file.size > 500_000) { alert('Maks 500KB'); return; }

		const reader = new FileReader();
		reader.onload = async () => {
			const avatar = reader.result as string;
			const res = await fetch('/api/master-participants', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, avatar })
			});
			if (res.ok) {
				masterList = masterList.map((p) => p.id === id ? { ...p, avatar } : p);
			}
		};
		reader.readAsDataURL(file);
	}

	async function removeAvatar(id: string) {
		const res = await fetch('/api/master-participants', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, avatar: null })
		});
		if (res.ok) {
			masterList = masterList.map((p) => p.id === id ? { ...p, avatar: null } : p);
		}
	}

	async function deleteMaster(id: string) {
		if (!confirm('Hapus peserta ini dari master? Data di turnamen yang sudah berjalan tidak terpengaruh.')) return;
		const res = await fetch('/api/master-participants', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});
		if (res.ok) {
			masterList = masterList.filter((p) => p.id !== id);
		}
	}
</script>

<div class="mx-auto max-w-3xl px-4 py-8">
	<div class="mb-6 flex items-center gap-4">
		<a href="/admin" class="text-blue-600 hover:underline">&larr; Kembali</a>
		<h1 class="text-2xl font-bold">Master Peserta</h1>
		<span class="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900 dark:text-red-300">Admin</span>
		<span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
			{masterList.length} peserta
		</span>
	</div>

	<div class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
		<h2 class="mb-4 text-lg font-semibold">Tambah Peserta Baru</h2>
		<form onsubmit={(e) => { e.preventDefault(); addMaster(); }} class="flex gap-3">
			<input
				type="text"
				bind:value={newName}
				placeholder="Nama peserta..."
				class="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
			/>
			<button
				type="submit"
				disabled={adding || !newName.trim()}
				class="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
			>
				Tambah
			</button>
		</form>
	</div>

	{#if masterList.length > 0}
		<div class="mb-4">
			<input
				type="text"
				bind:value={search}
				placeholder="Cari peserta..."
				class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
			/>
		</div>

		<div class="space-y-2">
			{#each filtered as p (p.id)}
				<div class="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
					<!-- Avatar -->
					<div class="relative h-12 w-12 flex-shrink-0">
						{#if p.avatar}
							<img src={p.avatar} alt={p.name} class="h-12 w-12 rounded-full object-cover" />
							<button
								onclick={() => removeAvatar(p.id)}
								class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
							>&times;</button>
						{:else}
							<label class="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-400 dark:hover:bg-gray-500" title="Upload foto">
								<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
								<input type="file" accept="image/*" class="hidden" onchange={(e) => uploadAvatar(p.id, e)} />
							</label>
						{/if}
					</div>

					<!-- Name -->
					<div class="flex-1">
						{#if editingId === p.id}
							<form onsubmit={(e) => { e.preventDefault(); saveName(p.id); }} class="flex items-center gap-2">
								<input
									type="text"
									bind:value={editedName}
									class="w-full rounded border border-blue-400 px-2 py-1 focus:outline-none dark:border-blue-600 dark:bg-gray-700"
									autofocus
								/>
								<button type="submit" class="text-sm text-blue-600 hover:underline">OK</button>
								<button type="button" onclick={() => editingId = null} class="text-sm text-gray-500 hover:underline">Batal</button>
							</form>
						{:else}
							<button
								onclick={() => { editingId = p.id; editedName = p.name; }}
								class="text-left font-medium hover:text-blue-600"
								title="Klik untuk edit"
							>
								{p.name}
							</button>
						{/if}
					</div>

					<!-- Delete -->
					<button
						onclick={() => deleteMaster(p.id)}
						class="rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
						title="Hapus"
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
					</button>
				</div>
			{/each}
		</div>

		{#if search && filtered.length === 0}
			<p class="mt-4 text-center text-gray-500">Tidak ada peserta yang cocok dengan "{search}"</p>
		{/if}
	{:else}
		<p class="text-center text-gray-500">Belum ada peserta di master. Peserta akan otomatis tersimpan saat ditambahkan ke turnamen.</p>
	{/if}
</div>
