<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Tournament Bracket</title>
</svelte:head>

<div class="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
	{@render children()}
</div>
