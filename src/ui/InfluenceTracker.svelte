<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { adjust, playerView, toggled, type CheckGroup, type InfluenceData, type InfluenceState } from '../influence/model';
  import { changesInfluence, postCheck, readState, resetState, writeState } from '../influence/runtime';
  import InfluenceFindings from './InfluenceFindings.svelte';
  import InfluenceMeter from './InfluenceMeter.svelte';
  import InfluenceStatBlock from './InfluenceStatBlock.svelte';
  import { t } from './influence-i18n';

  let {
    scene,
    data,
    folded: startFolded,
    onFold,
  }: { scene: Scene; data?: InfluenceData; folded: boolean; onFold: (folded: boolean) => void } = $props();

  let tracker = $state<InfluenceState>(untrack(() => readState(scene)));
  let folded = $state(untrack(() => startFolded));
  let previewing = $state(false);

  // Players read the view the GM's client stored; the GM's preview builds the same view locally.
  const view = $derived(data ? playerView(data, tracker.revealed, tracker.active) : tracker.view);

  const fold = () => {
    folded = !folded;
    onFold(folded);
  };

  const change = (edit: (current: InfluenceState) => Partial<InfluenceState>) => {
    if (data) void writeState(scene, data, edit);
  };

  const post = (group: CheckGroup, entry: string) => {
    if (data) void postCheck(data, group, entry);
  };

  const reset = () => {
    if (data) void resetState(scene, data);
  };

  onMount(() => {
    const id = Hooks.on('updateScene', (updated: Scene, changed: object) => {
      if (updated === scene && changesInfluence(changed)) tracker = readState(scene);
    });
    return () => Hooks.off('updateScene', id);
  });
</script>

{#if view}
  <div class={['poi-tracker', { 'poi-tracker-gm': !!data }]}>
    <header class="poi-tracker-head">
      <button type="button" class="poi-grip" aria-label={t('Grip')} aria-expanded={!folded} ondblclick={fold}>
        <i class="fa-solid fa-grip-vertical"></i>
      </button>
      <img src={view.img} alt="" />
      <div class="poi-tracker-title">
        <h2>{view.name}</h2>
        {#if data}<p>{data.aside}</p>{/if}
      </div>
      {#if data}
        <button type="button" class="poi-tracker-share" onclick={() => change((s) => ({ shown: !s.shown }))}>
          <i class={['fa-solid', tracker.shown ? 'fa-eye-slash' : 'fa-eye']}></i>
          {t(tracker.shown ? 'Hide' : 'Show')}
        </button>
      {/if}
    </header>

    {#if !folded}
      {#if data}
        <div class="poi-tracker-views" role="group" aria-label={t('Views')}>
          <button type="button" aria-pressed={!previewing} onclick={() => (previewing = false)}>
            <i class="fa-solid fa-book-open" aria-hidden="true"></i>
            {t('GMView')}
          </button>
          <button type="button" aria-pressed={previewing} onclick={() => (previewing = true)}>
            <i class="fa-solid fa-users" aria-hidden="true"></i>
            {t('PlayerView')}
          </button>
        </div>
      {/if}

      <div class="poi-tracker-body">
        {#if data && !previewing}
          <InfluenceMeter
            points={tracker.points}
            round={tracker.round}
            thresholds={view.thresholds}
            rounds={view.rounds}
            onPoints={(by) => change((s) => ({ points: adjust(s.points, by, 0) }))}
            onRound={(by) => change((s) => ({ round: adjust(s.round, by, 1) }))}
          />
          <InfluenceStatBlock
            {data}
            points={tracker.points}
            revealed={tracker.revealed}
            active={tracker.active}
            onReveal={(key) => change((s) => ({ revealed: toggled(s.revealed, key) }))}
            onActivate={(key) => change((s) => ({ active: toggled(s.active, key) }))}
            onPost={post}
          />
          <button type="button" class="poi-tracker-reset" onclick={reset}>
            <i class="fa-solid fa-rotate-left"></i>
            {t('Reset')}
          </button>
        {:else}
          <InfluenceMeter points={tracker.points} round={tracker.round} thresholds={view.thresholds} rounds={view.rounds} />
          <InfluenceFindings items={view.items} />
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .poi-tracker {
    width: 24rem;
    max-width: calc(100vw - 2rem);
  }

  .poi-tracker-gm {
    width: 30rem;
  }

  .poi-tracker-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .poi-grip {
    flex: none;
    width: auto;
    padding: 0 0.25rem;
    border: none;
    background: none;
    color: inherit;
    cursor: grab;
    opacity: 0.7;
  }

  img {
    flex: none;
    width: 3rem;
    height: 3rem;
    border: 1px solid var(--poi-tracker-gold);
    border-radius: 50%;
    object-fit: cover;
    object-position: top;
  }

  .poi-tracker-title {
    flex: 1;
    min-width: 0;

    p {
      margin: 0;
      font-size: 0.875rem;
      font-style: italic;
      opacity: 0.8;
    }
  }

  h2 {
    margin: 0;
    border: none;
    font-family: var(--poi-tracker-display);
    font-size: 1.6875rem;
    font-weight: 400;
    line-height: 1.2;
  }

  button {
    flex: none;
    width: auto;
    white-space: nowrap;
  }

  .poi-tracker-views {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.5rem;

    button {
      flex: 1;
      opacity: 0.7;
    }

    button[aria-pressed='true'] {
      border-color: var(--poi-tracker-gold);
      background: var(--poi-tracker-wash);
      opacity: 1;
    }
  }

  .poi-tracker-body {
    max-height: 70vh;
    overflow-y: auto;
    padding: 0.5rem 0.25rem 0.25rem;
    scrollbar-width: thin;
    scrollbar-color: var(--poi-tracker-gold) transparent;
  }

  .poi-tracker-reset {
    margin-top: 0.75rem;
  }
</style>
