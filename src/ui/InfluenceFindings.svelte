<script lang="ts">
  import { GROUPS, type InfluenceView } from '../influence/model';
  import { t } from './influence-i18n';

  let { items }: { items: InfluenceView['items'] } = $props();
</script>

{#if items.length}
  {#each GROUPS as group (group)}
    {@const found = items.filter((item) => item.group === group)}
    {#if found.length}
      <h3>{t(`Groups.${group}`)}</h3>
      <ul>
        {#each found as item, i (i)}
          <li>{item.text}</li>
        {/each}
      </ul>
    {/if}
  {/each}
{:else}
  <p>{t('Nothing')}</p>
{/if}

<style>
  h3 {
    margin: 0.75rem 0 0.25rem;
    border: none;
    font-family: var(--poi-tracker-serif);
    font-size: 1rem;
    font-weight: 700;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    margin: 0.25rem 0 0;
    line-height: 1.4;
  }

  p {
    margin: 0;
    font-style: italic;
    opacity: 0.75;
  }
</style>
