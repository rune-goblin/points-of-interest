import type { ApplicationRenderOptions } from 'foundry-pf2e/foundry/client/applications/_types.mjs';
import { mount, unmount } from 'svelte';
import { MODULE_ID } from '../constants';
import type { InfluenceData } from '../influence/model';
import { changesInfluence, influenceData, readState } from '../influence/runtime';
import InfluenceTracker from './InfluenceTracker.svelte';

const { ApplicationV2 } = foundry.applications.api;

const POSITION = 'influencePanelPosition';
const FOLDED = 'influencePanelFolded';
interface Position { left: number; top: number }

const savePosition = foundry.utils.debounce((position: Position) => void game.settings.set(MODULE_ID, POSITION, position), 500);

export class InfluencePanel extends ApplicationV2 {
  static override DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-influence`,
    classes: [`${MODULE_ID}-influence`],
    window: { frame: false, positioned: true },
    position: { width: 'auto' as const, height: 'auto' as const, top: 160, left: 120 },
  };

  #component?: ReturnType<typeof mount>;
  #root?: HTMLElement;

  constructor(readonly scene: Scene, readonly data?: InfluenceData) {
    super({ position: { ...(game.settings.get(MODULE_ID, POSITION) as Partial<Position>) } });
  }

  protected override async _renderHTML(): Promise<HTMLElement> {
    if (!this.#component) {
      this.#root = document.createElement('div');
      this.#component = mount(InfluenceTracker, {
        target: this.#root,
        props: {
          scene: this.scene,
          data: this.data,
          folded: game.settings.get(MODULE_ID, FOLDED) as boolean,
          onFold: (folded: boolean) => void game.settings.set(MODULE_ID, FOLDED, folded),
        },
      });
    }
    return this.#root!;
  }

  protected override _replaceHTML(result: HTMLElement, content: HTMLElement): void {
    content.replaceChildren(result);
  }

  // A frameless app gets neither Foundry's theme classes nor its header drag, so it takes both here.
  protected override async _onFirstRender(context: object, options: ApplicationRenderOptions): Promise<void> {
    await super._onFirstRender(context, options);
    const { colorScheme } = game.settings.get('core', 'uiConfig') as { colorScheme: { interface?: string } };
    if (colorScheme.interface) this.element.classList.add('themed', `theme-${colorScheme.interface}`);
    const grip = this.element.querySelector<HTMLElement>('.poi-grip');
    if (grip) new foundry.applications.ux.Draggable.implementation(this, this.element, grip, false);
  }

  protected override _onPosition(position: { left: number; top: number }): void {
    savePosition({ left: position.left, top: position.top });
  }

  protected override async _preClose(): Promise<void> {
    if (this.#component) {
      void unmount(this.#component);
      this.#component = undefined;
      this.#root = undefined;
    }
  }
}

let panel: InfluencePanel | undefined;
let pending = 0;

// The GM's tracker follows the viewed scene; a player's follows the GM's Show players toggle.
async function sync(): Promise<void> {
  const ticket = ++pending;
  const scene = canvas.ready ? canvas.scene : null;
  const data = scene && game.user.isGM ? await influenceData(scene) : undefined;
  if (ticket !== pending) return;
  const wanted = scene && (game.user.isGM ? !!data : readState(scene).shown) ? scene : null;
  // Both panels share one app id, so the old one must leave the DOM before the next renders.
  if (panel && panel.scene !== wanted) {
    const old = panel;
    panel = undefined;
    if (old.rendered) await old.close();
    if (ticket !== pending) return;
  }
  if (wanted && !panel) {
    panel = new InfluencePanel(wanted, data);
    void panel.render({ force: true });
  }
}

export function registerInfluencePanel(): void {
  game.settings.register(MODULE_ID, FOLDED, { name: FOLDED, scope: 'client', config: false, type: Boolean, default: false });
  game.settings.register(MODULE_ID, POSITION, { name: POSITION, scope: 'client', config: false, type: Object, default: {} });
  Hooks.on('canvasReady', () => void sync());
  Hooks.on('updateScene', (scene: Scene, changed: object) => {
    if (!game.user.isGM && scene === canvas.scene && changesInfluence(changed)) void sync();
  });
}
