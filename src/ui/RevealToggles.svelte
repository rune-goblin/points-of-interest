<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { MODULE_ID } from '../constants';
  import { isRevealTile } from '../reveals';

  let { scene, folded: startFolded, onFold }: { scene: Scene; folded: boolean; onFold: (folded: boolean) => void } = $props();

  interface Row {
    id: string;
    name: string;
    hidden: boolean;
  }

  let rows = $state<Row[]>([]);
  let folded = $state(untrack(() => startFolded));

  const fold = () => {
    folded = !folded;
    onFold(folded);
  };

  // v14 added Tile#name; the typedefs predate it.
  const read = (): Row[] =>
    scene.tiles
      .filter(isRevealTile)
      .map((tile) => ({ id: tile.id!, name: (tile as { name?: string }).name ?? '', hidden: tile.hidden }));

  const t = (key: string, data: Record<string, string> = {}) => game.i18n.format(`${MODULE_ID}.Reveals.${key}`, data);

  // Showing a tile fades it in through the updateTile hook in src/reveals.ts.
  const toggle = (row: Row) => scene.updateEmbeddedDocuments('Tile', [{ _id: row.id, hidden: !row.hidden }]);

  onMount(() => {
    rows = read();
    const refresh = (tile: TileDocument<Scene | null>) => {
      if (tile.parent === scene) rows = read();
    };
    const hooks = ['createTile', 'updateTile', 'deleteTile'].map((hook) => ({ hook, id: Hooks.on(hook, refresh) }));
    return () => {
      for (const { hook, id } of hooks) Hooks.off(hook, id);
    };
  });
</script>

<button type="button" class="poi-grip" aria-label={t('Grip')} aria-expanded={!folded} ondblclick={fold}>
  <i class="fa-solid fa-grip-vertical"></i>
</button>
{#if !folded}
  {#each rows as row (row.id)}
    <button type="button" onclick={() => toggle(row)}>
      <i class={['fa-solid', row.hidden ? 'fa-eye' : 'fa-eye-slash']}></i>
      {t(row.hidden ? 'Show' : 'Hide', { name: row.name })}
    </button>
  {/each}
{/if}

<style>
  .poi-grip {
    padding: 0 0.25rem;
    border: none;
    background: none;
    color: inherit;
    cursor: grab;
    opacity: 0.7;
  }

  button {
    flex: none;
    width: auto;
    white-space: nowrap;
  }
</style>
