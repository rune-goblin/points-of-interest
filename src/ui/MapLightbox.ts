import type { ApplicationRenderOptions } from 'foundry-pf2e/foundry/client/applications/_types.mjs';
import { mount, unmount } from 'svelte';
import { MODULE_ID } from '../constants';
import Lightbox from './MapLightbox.svelte';

const { ApplicationV2 } = foundry.applications.api;

export class MapLightbox extends ApplicationV2 {
  static override DEFAULT_OPTIONS = {
    classes: [`${MODULE_ID}-lightbox`],
    window: { frame: false, positioned: false },
  };

  static open(src: string, caption: string): void {
    void new MapLightbox(src, caption).render({ force: true });
  }

  #component?: ReturnType<typeof mount>;
  #root?: HTMLElement;

  constructor(
    readonly src: string,
    readonly caption: string,
  ) {
    super();
  }

  protected override async _renderHTML(): Promise<HTMLElement> {
    if (!this.#component) {
      this.#root = document.createElement('div');
      this.#component = mount(Lightbox, {
        target: this.#root,
        // The close animation waits on a transition this app never runs.
        props: { src: this.src, caption: this.caption, onClosed: () => void this.close({ animate: false }) },
      });
    }
    return this.#root!;
  }

  protected override _replaceHTML(result: HTMLElement, content: HTMLElement): void {
    content.replaceChildren(result);
  }

  // showModal() throws on a dialog outside the document, so it waits for the first insert.
  protected override async _onFirstRender(context: object, options: ApplicationRenderOptions): Promise<void> {
    await super._onFirstRender(context, options);
    this.element.querySelector('dialog')?.showModal();
  }

  protected override async _preClose(): Promise<void> {
    if (this.#component) {
      void unmount(this.#component);
      this.#component = undefined;
      this.#root = undefined;
    }
  }
}
