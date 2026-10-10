<script lang="ts">
  import { meterLength } from '../influence/model';
  import { t } from './influence-i18n';

  let {
    points,
    round,
    thresholds,
    rounds,
    onPoints,
    onRound,
  }: {
    points: number;
    round: number;
    thresholds: number[];
    rounds: number | null;
    onPoints?: (by: number) => void;
    onRound?: (by: number) => void;
  } = $props();

  const length = $derived(meterLength(thresholds, points));
  const overTime = $derived(!!rounds && round > rounds);
</script>

<div class="poi-tracker-row">
  <span>{t('Points')}</span>
  {#if onPoints}
    <button type="button" aria-label={t('Lower')} disabled={points === 0} onclick={() => onPoints?.(-1)}>
      <i class="fa-solid fa-minus"></i>
    </button>
  {/if}
  <output>{points}</output>
  {#if onPoints}
    <button type="button" aria-label={t('Raise')} onclick={() => onPoints?.(1)}>
      <i class="fa-solid fa-plus"></i>
    </button>
  {/if}
</div>

<ol
  class="poi-tracker-meter"
  role="meter"
  aria-label={t('Meter', { points, goal: length })}
  aria-valuemin={0}
  aria-valuemax={length}
  aria-valuenow={points}
>
  {#each { length }, i (i)}
    {@const step = i + 1}
    <li class={{ filled: step <= points, threshold: thresholds.includes(step) }}>
      {#if thresholds.includes(step)}<span>{step}</span>{/if}
    </li>
  {/each}
</ol>

{#if rounds}
  <div class={['poi-tracker-row', { 'poi-tracker-late': overTime }]}>
    <span>{t('Round', { round, rounds })}</span>
    {#if onRound}
      <button type="button" aria-label={t('PreviousRound')} disabled={round === 1} onclick={() => onRound?.(-1)}>
        <i class="fa-solid fa-minus"></i>
      </button>
      <button type="button" aria-label={t('NextRound')} onclick={() => onRound?.(1)}>
        <i class="fa-solid fa-plus"></i>
      </button>
    {/if}
  </div>
{/if}

<style>
  .poi-tracker-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2rem;

    > span {
      flex: 1;
    }

    > button {
      flex: none;
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
</style>
