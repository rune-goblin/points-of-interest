import type { ApplicationRenderOptions } from 'foundry-pf2e/foundry/client/applications/_types.mjs';
import { mount, unmount } from 'svelte';
import { MODULE_ID } from '../constants';
import { isRevealTile } from '../reveals';
import RevealToggles from './RevealToggles.svelte';

const { ApplicationV2 } = foundry.applications.api;

const POSITION = 'revealPanelPosition';
const FOLDED = 'revealPanelFolded';
interface Position { left: number; top: number }

const savePosition = foundry.utils.debounce((position: Position) => void game.settings.set(MODULE_ID, POSITION, position), 500);

export class RevealPanel extends ApplicationV2 {
  static override DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-reveals`,
    classes: [`${MODULE_ID}-reveals`],
    window: { frame: false, positioned: true },
    position: { width: 'auto' as const, height: 'auto' as const, top: 100, left: 120 },
  };

  #component?: ReturnType<typeof mount>;
  #root?: HTMLElement;

  constructor(readonly scene: Scene) {
    super({ position: { ...(game.settings.get(MODULE_ID, POSITION) as Partial<Position>) } });
  }

  protected override async _renderHTML(): Promise<HTMLElement> {
    if (!this.#component) {
      this.#root = document.createElement('div');
      this.#component = mount(RevealToggles, {
        target: this.#root,
        props: {
          scene: this.scene,
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

let panel: RevealPanel | undefined;

// A panel the GM closed stays closed until the canvas shows another scene.
function sync(): void {
  const scene = canvas.ready ? canvas.scene : null;
  const wanted = game.user.isGM && scene?.tiles.some(isRevealTile) ? scene : null;
  if (panel && panel.scene !== wanted) {
    if (panel.rendered) void panel.close();
    panel = undefined;
  }
  if (wanted && !panel) {
    panel = new RevealPanel(wanted);
    void panel.render({ force: true });
  }
}

export function registerRevealPanel(): void {
  game.settings.register(MODULE_ID, FOLDED, { name: FOLDED, scope: 'client', config: false, type: Boolean, default: false });
  game.settings.register(MODULE_ID, POSITION, { name: POSITION, scope: 'client', config: false, type: Object, default: {} });
  Hooks.on('canvasReady', sync);
  Hooks.on('createTile', (tile: TileDocument<Scene | null>) => tile.parent === canvas.scene && sync());
  Hooks.on('deleteTile', (tile: TileDocument<Scene | null>) => tile.parent === canvas.scene && sync());
}
