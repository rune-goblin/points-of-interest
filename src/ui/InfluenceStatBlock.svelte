<script lang="ts">
  import { influenceItems, modifierOf, type CheckGroup, type InfluenceData, type InfluenceGroup, type InfluenceItem } from '../influence/model';
  import { t } from './influence-i18n';

  let {
    data,
    points,
    revealed,
    active,
    onReveal,
    onActivate,
    onPost,
  }: {
    data: InfluenceData;
    points: number;
    revealed: string[];
    active: string[];
    onReveal: (key: string) => void;
    onActivate: (key: string) => void;
    onPost: (group: CheckGroup, entry: string) => void;
  } = $props();

  const items = $derived(influenceItems(data, active));
  const inGroup = (group: InfluenceGroup): InfluenceItem[] => items.filter((item) => item.group === group);
  const signed = (shift: number): string => (shift > 0 ? `+${shift}` : `–${-shift}`);
</script>

{#snippet reveal(item: InfluenceItem)}
  {@const shown = revealed.includes(item.key)}
  <button
    type="button"
    aria-pressed={shown}
    aria-label={t(shown ? 'HideEntry' : 'RevealEntry')}
    data-tooltip={t(shown ? 'HideEntry' : 'RevealEntry')}
    onclick={() => onReveal(item.key)}
  >
    <i class={['fa-solid', shown ? 'fa-eye' : 'fa-eye-slash']} aria-hidden="true"></i>
  </button>
{/snippet}

{#snippet checks(name: CheckGroup)}
  <h3>{t(`Groups.${name}`)}</h3>
  <ul>
    {#each inGroup(name) as item (item.key)}
      <li class={{ revealed: revealed.includes(item.key) }}>
        <span>
          {item.text}
          {#if item.shift}<small data-tooltip={t('Shifted', { by: signed(item.shift) })}>{signed(item.shift)}</small>{/if}
        </span>
        {@render reveal(item)}
        <button type="button" aria-label={t('PostCheck')} data-tooltip={t('PostCheck')} onclick={() => onPost(name, item.text)}>
          <i class="fa-solid fa-message" aria-hidden="true"></i>
        </button>
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet notes(name: 'resistances' | 'weaknesses')}
  <h3>{t(`Groups.${name}`)}</h3>
  <ul>
    {#each inGroup(name) as item (item.key)}
      {@const on = active.includes(item.key)}
      <li class={{ revealed: revealed.includes(item.key), active: on }}>
        {#if modifierOf(item.text)}
          <input type="checkbox" checked={on} aria-label={t('Apply')} data-tooltip={t('Apply')} onchange={() => onActivate(item.key)} />
        {:else}
          <i class="poi-statblock-gap" aria-hidden="true"></i>
        {/if}
        <span>{item.text}</span>
        {@render reveal(item)}
      </li>
    {/each}
  </ul>
{/snippet}

<section class="poi-statblock" aria-label={t('StatBlock')}>
  <p><strong>{t('Perception')}</strong> {data.perception}; <strong>{t('Will')}</strong> {data.will}</p>
  {@render checks('discovery')}
  {@render checks('skills')}
  <ol class="poi-statblock-thresholds">
    {#each data.thresholds as threshold (threshold.points)}
      <li class={{ reached: points >= threshold.points }}>
        <strong>{t('Threshold', { points: threshold.points })}</strong>
        {threshold.text}
      </li>
    {/each}
  </ol>
  {@render notes('resistances')}
  {@render notes('weaknesses')}
  <p class="poi-statblock-penalty"><strong>{t('Penalty')}</strong> {data.penalty}</p>
</section>

<style>
  .poi-statblock {
    margin-top: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--poi-tracker-rule);
    line-height: 1.4;
  }

  p {
    margin: 0.25rem 0;
  }

  strong {
    font-family: var(--poi-tracker-serif);
  }

  h3 {
    margin: 0.75rem 0 0.125rem;
    border: none;
    font-family: var(--poi-tracker-serif);
    font-size: 1rem;
    font-weight: 700;
  }

  ul,
  ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  ul li {
    display: flex;
    align-items: flex-start;
    gap: 0.25rem;
    margin: 0;
    padding: 0.25rem 0 0.25rem 0.5rem;
    border-left: 2px solid transparent;

    > span {
      flex: 1;
      padding-top: 0.125rem;
    }

    > button {
      flex: none;
      width: 1.75rem;
      height: 1.75rem;
      padding: 0;
      border-color: transparent;
      background: none;
      color: inherit;
      opacity: 0.7;
    }

    > button:hover,
    > button:focus-visible {
      border-color: var(--poi-tracker-gold);
      opacity: 1;
    }
  }

  ul li.revealed {
    border-left-color: var(--poi-tracker-gold);
    background: var(--poi-tracker-wash);

    > button[aria-pressed='true'] {
      color: var(--poi-tracker-gold);
      opacity: 1;
    }
  }

  ul li.active {
    border-left-color: var(--poi-tracker-accent);
  }

  input[type='checkbox'],
  .poi-statblock-gap {
    flex: none;
    width: 1.25rem;
    height: 1.25rem;
    margin: 0.25rem 0.25rem 0 0;
  }

  small {
    margin-left: 0.25rem;
    padding: 0 0.375rem;
    border: 1px solid var(--poi-tracker-accent);
    border-radius: 0.75rem;
    color: var(--poi-tracker-accent);
    font-size: 0.8125rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .poi-statblock-thresholds {
    margin-top: 0.75rem;

    li {
      margin: 0.375rem 0 0;
      opacity: 0.75;
    }

    li.reached {
      opacity: 1;
    }

    li.reached strong {
      color: var(--poi-tracker-accent);
    }
  }

  .poi-statblock-penalty {
    margin-top: 0.75rem;
  }
</style>
