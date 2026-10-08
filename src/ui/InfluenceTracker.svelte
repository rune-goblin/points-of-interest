<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { MODULE_ID } from '../constants';
  import { adjust, GROUPS, influenceItems, meterLength, playerView, toggled, type InfluenceData, type InfluenceState } from '../influence/model';
  import { changesInfluence, readState, resetState, writeState } from '../influence/runtime';

  let {
    scene,
    data,
    folded: startFolded,
    onFold,
  }: { scene: Scene; data?: InfluenceData; folded: boolean; onFold: (folded: boolean) => void } = $props();

  let tracker = $state<InfluenceState>(untrack(() => readState(scene)));
  let folded = $state(untrack(() => startFolded));

  const view = $derived(data ? playerView(data, tracker.revealed) : tracker.view);
  const items = $derived(data ? influenceItems(data) : []);
  const length = $derived(view ? meterLength(view.thresholds, tracker.points) : 0);
  const overTime = $derived(!!view?.rounds && tracker.round > view.rounds);

  const t = (key: string, values: Record<string, string | number> = {}) =>
    game.i18n.format(
      `${MODULE_ID}.Influence.${key}`,
      Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)])),
    );

  const fold = () => {
    folded = !folded;
    onFold(folded);
  };

  const change = (edit: (current: InfluenceState) => Partial<InfluenceState>) => {
    if (data) void writeState(scene, data, edit);
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
  <header class="poi-tracker-head">
    <button type="button" class="poi-grip" aria-label={t('Grip')} aria-expanded={!folded} ondblclick={fold}>
      <i class="fa-solid fa-grip-vertical"></i>
    </button>
    <img src={view.img} alt="" />
    <h2>{view.name}</h2>
    {#if data}
      <button type="button" class="poi-tracker-share" onclick={() => change((s) => ({ shown: !s.shown }))}>
        <i class={['fa-solid', tracker.shown ? 'fa-eye-slash' : 'fa-eye']}></i>
        {t(tracker.shown ? 'Hide' : 'Show')}
      </button>
    {/if}
  </header>

  {#if !folded}
    <div class="poi-tracker-body">
      <div class="poi-tracker-row">
        <span>{t('Points')}</span>
        {#if data}
          <button type="button" aria-label={t('Lower')} disabled={tracker.points === 0} onclick={() => change((s) => ({ points: adjust(s.points, -1, 0) }))}>
            <i class="fa-solid fa-minus"></i>
          </button>
        {/if}
        <output>{tracker.points}</output>
        {#if data}
          <button type="button" aria-label={t('Raise')} onclick={() => change((s) => ({ points: adjust(s.points, 1, 0) }))}>
            <i class="fa-solid fa-plus"></i>
          </button>
        {/if}
      </div>

      <ol
        class="poi-tracker-meter"
        role="meter"
        aria-label={t('Meter', { points: tracker.points, goal: length })}
        aria-valuemin={0}
        aria-valuemax={length}
        aria-valuenow={tracker.points}
      >
        {#each { length }, i (i)}
          {@const step = i + 1}
          <li class={{ filled: step <= tracker.points, threshold: view.thresholds.includes(step) }}>
            {#if view.thresholds.includes(step)}<span>{step}</span>{/if}
          </li>
        {/each}
      </ol>

      {#if view.rounds}
        <div class={['poi-tracker-row', { 'poi-tracker-late': overTime }]}>
          <span>{t('Round', { round: tracker.round, rounds: view.rounds })}</span>
          {#if data}
            <button type="button" aria-label={t('PreviousRound')} disabled={tracker.round === 1} onclick={() => change((s) => ({ round: adjust(s.round, -1, 1) }))}>
              <i class="fa-solid fa-minus"></i>
            </button>
            <button type="button" aria-label={t('NextRound')} onclick={() => change((s) => ({ round: adjust(s.round, 1, 1) }))}>
              <i class="fa-solid fa-plus"></i>
            </button>
          {/if}
        </div>
      {/if}

      {#if data}
        <details open>
          <summary>{t('Thresholds')}</summary>
          <ol class="poi-tracker-thresholds">
            {#each data.thresholds as threshold (threshold.points)}
              <li class={{ reached: tracker.points >= threshold.points }}>
                <strong>{threshold.points}</strong>
                <span>{threshold.text}</span>
              </li>
            {/each}
          </ol>
        </details>

        <details open>
          <summary>{t('Reveal')}</summary>
          {#each GROUPS as group (group)}
            <h3>{t(`Groups.${group}`)}</h3>
            <ul class="poi-tracker-items">
              {#each items.filter((item) => item.group === group) as item (item.key)}
                {@const shown = tracker.revealed.includes(item.key)}
                <li>
                  <button
                    type="button"
                    class={{ revealed: shown }}
                    aria-pressed={shown}
                    onclick={() => change((s) => ({ revealed: toggled(s.revealed, item.key) }))}
                  >
                    <i class={['fa-solid', shown ? 'fa-eye' : 'fa-eye-slash']} aria-hidden="true"></i>
                    <span>{item.text}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/each}
        </details>

        <p class="poi-tracker-penalty"><strong>{t('Penalty')}</strong> {data.penalty}</p>
        <button type="button" class="poi-tracker-reset" onclick={reset}>
          <i class="fa-solid fa-rotate-left"></i>
          {t('Reset')}
        </button>
      {:else if view.items.length}
        {#each GROUPS as group (group)}
          {@const found = view.items.filter((item) => item.group === group)}
          {#if found.length}
            <h3>{t(`Groups.${group}`)}</h3>
            <ul class="poi-tracker-found">
              {#each found as item, i (i)}
                <li>{item.text}</li>
              {/each}
            </ul>
          {/if}
        {/each}
      {:else}
        <p class="poi-tracker-empty">{t('Nothing')}</p>
      {/if}
    </div>
  {/if}
{/if}

<style>
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

  h2 {
    flex: 1;
    margin: 0;
    border: none;
    font-family: var(--poi-tracker-display);
    font-size: 1.6875rem;
    font-weight: 400;
    line-height: 1.2;
  }

  h3 {
    margin: 0.75rem 0 0.25rem;
    border: none;
    font-family: var(--poi-tracker-serif);
    font-size: 1rem;
    font-weight: 700;
  }

  button {
    flex: none;
    width: auto;
    white-space: nowrap;
  }

  .poi-tracker-body {
    width: 22rem;
    max-width: calc(100vw - 2rem);
    max-height: 70vh;
    overflow-y: auto;
    padding: 0.5rem 0.25rem 0.25rem;
  }

  .poi-tracker-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2rem;

    > span {
      flex: 1;
    }

    > button {
      width: 2rem;
      height: 2rem;
      padding: 0;
    }
  }

  output {
    min-width: 2ch;
    font-family: var(--poi-tracker-display);
    font-size: 1.6875rem;
    line-height: 1;
    text-align: center;
  }

  .poi-tracker-late > span {
    color: var(--poi-tracker-accent);
    font-weight: 700;
  }

  .poi-tracker-meter {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin: 0.5rem 0 1.5rem;
    padding: 0;
    list-style: none;

    li {
      position: relative;
      width: 1.25rem;
      height: 1.25rem;
      margin: 0;
    }

    li::before {
      content: '';
      position: absolute;
      inset: 0;
      border: 1px solid var(--poi-tracker-gold);
      border-radius: 50%;
    }

    li.filled::before {
      background: var(--poi-tracker-gold);
    }

    li.threshold::before {
      inset: 0.125rem;
      border: 2px solid var(--poi-tracker-accent);
      border-radius: 0.125rem;
      transform: rotate(45deg);
    }

    li.threshold.filled::before {
      background: var(--poi-tracker-accent);
    }

    span {
      position: absolute;
      top: 1.375rem;
      left: 50%;
      font-size: 0.875rem;
      transform: translateX(-50%);
    }
  }

  details {
    margin-top: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--poi-tracker-rule);
  }

  summary {
    font-family: var(--poi-tracker-serif);
    font-weight: 700;
    cursor: pointer;
  }

  ol.poi-tracker-thresholds,
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .poi-tracker-thresholds li {
    display: flex;
    gap: 0.5rem;
    margin: 0.5rem 0 0;
    opacity: 0.75;

    strong {
      flex: none;
      width: 1.5rem;
      color: var(--poi-tracker-accent);
      text-align: center;
    }
  }

  .poi-tracker-thresholds li.reached {
    opacity: 1;
  }

  .poi-tracker-items button {
    display: flex;
    align-items: baseline;
    justify-content: flex-start;
    gap: 0.5rem;
    width: 100%;
    height: auto;
    margin: 0.125rem 0;
    padding: 0.25rem 0.5rem;
    border-color: transparent;
    background: none;
    color: inherit;
    line-height: 1.4;
    text-align: start;
    white-space: normal;
    opacity: 0.7;
  }

  .poi-tracker-items button.revealed {
    border-color: var(--poi-tracker-gold);
    background: var(--poi-tracker-wash);
    opacity: 1;
  }

  .poi-tracker-found li {
    margin: 0.25rem 0 0;
    line-height: 1.4;
  }

  .poi-tracker-penalty {
    margin: 0.75rem 0 0;
    padding-top: 0.5rem;
    border-top: 1px solid var(--poi-tracker-rule);
  }

  .poi-tracker-empty {
    margin: 0;
    font-style: italic;
    opacity: 0.75;
  }

  .poi-tracker-reset {
    margin-top: 0.75rem;
  }
</style>
