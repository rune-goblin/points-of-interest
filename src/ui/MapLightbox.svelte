<script lang="ts">
  import { MODULE_ID } from '../constants';

  let { src, caption, onClosed }: { src: string; caption: string; onClosed: () => void } = $props();

  let dialog: HTMLDialogElement;

  // The dialog handles Escape itself; Foundry's dismiss key would also close every framed window,
  // the journal behind it included.
  const keepEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') event.stopPropagation();
  };
</script>

<dialog
  bind:this={dialog}
  aria-label={caption}
  onclose={onClosed}
  onkeydown={keepEscape}
  onclick={(event) => event.target === dialog && dialog.close()}
>
  <figure>
    <img {src} alt={caption} />
    <figcaption>{caption}</figcaption>
  </figure>
  <button type="button" aria-label={game.i18n.localize(`${MODULE_ID}.Lightbox.Close`)} onclick={() => dialog.close()}>
    <i class="fa-solid fa-xmark"></i>
  </button>
</dialog>

<style>
  dialog {
    width: 100vw;
    height: 100vh;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 1.5rem;
    border: none;
    background: rgb(0 0 0 / 88%);
    color: #ece6d8;
    cursor: zoom-out;
    animation: fade-in 0.15s ease-out;
  }

  dialog[open] {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  dialog::backdrop {
    background: none;
  }

  figure {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
    cursor: default;
  }

  img {
    display: block;
    max-width: 100%;
    max-height: calc(100vh - 6rem);
    border: none;
    border-radius: 4px;
    box-shadow: 0 0 2rem rgb(0 0 0 / 60%);
  }

  figcaption {
    font-size: 1.125rem;
    font-weight: bold;
    text-shadow: 0 1px 2px #000;
  }

  button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgb(255 255 255 / 12%);
    color: inherit;
    font-size: 1.25rem;
    cursor: pointer;
  }

  button:hover {
    background: rgb(255 255 255 / 24%);
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
</style>
