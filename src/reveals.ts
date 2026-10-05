import { MODULE_ID } from './constants';

// A reveal tile (flag `reveal`, an actor id) holds a later state of its map, such as #11's pit once
// the guthallath tears free. It ships hidden and fades in when that actor's token first moves in a
// started combat; a GM can also show or hide it by hand.

const FADE_MS = 2000;
const fades = new Map<string, { alpha: number }>();

// The typedefs omit the members of the drawn Tile these hooks touch.
interface DrawnTile {
  document: TileDocument<Scene | null>;
  mesh: { alpha: number } | null;
  layer: { active: boolean };
  renderFlags: { set(flags: Record<string, boolean>): void };
}

const revealActor = (tile: TileDocument<Scene | null>) => tile.getFlag(MODULE_ID, 'reveal') as string | undefined;
export const isRevealTile = (tile: TileDocument<Scene | null>): boolean => !!revealActor(tile);

function fadeIn(tile: DrawnTile): void {
  const fade = { alpha: 0 };
  const id = tile.document.id!;
  fades.set(id, fade);
  void foundry.canvas.animation.CanvasAnimation.animate([{ parent: fade, attribute: 'alpha', to: 1 }], {
    name: `${MODULE_ID}.reveal.${id}`,
    duration: FADE_MS,
    ontick: () => tile.renderFlags.set({ refreshState: true }),
  }).finally(() => {
    fades.delete(id);
    tile.renderFlags.set({ refreshState: true });
  });
}

export function registerRevealHooks(): void {
  Hooks.on('updateToken', (token: TokenDocument<Scene | null>, changed: { x?: number; y?: number }) => {
    if (changed.x === undefined && changed.y === undefined) return;
    if (game.users.activeGM?.id !== game.user.id || !game.combat?.started || !token.inCombat) return;
    const scene = token.parent;
    const tiles = scene?.tiles.filter((t) => t.hidden && revealActor(t) === token.actorId) ?? [];
    if (tiles.length) void scene!.updateEmbeddedDocuments('Tile', tiles.map((t) => ({ _id: t.id, hidden: false })));
  });

  Hooks.on('updateTile', (tile: TileDocument<Scene | null>, changed: { hidden?: boolean }) => {
    if (changed.hidden === false && revealActor(tile) && tile.object) fadeIn(tile.object as unknown as DrawnTile);
  });

  Hooks.on('refreshTile', (tile: DrawnTile, flags: { refreshState?: boolean }) => {
    if (!flags.refreshState || !tile.mesh || !revealActor(tile.document)) return;
    // Foundry draws a hidden tile at half opacity for the GM, which would lay the pit over the buried
    // Colossus until it wakes. The Tiles layer still shows it.
    if (tile.document.hidden && !tile.layer.active) tile.mesh.alpha = 0;
    const fade = fades.get(tile.document.id!);
    if (fade) tile.mesh.alpha *= fade.alpha;
  });
}
