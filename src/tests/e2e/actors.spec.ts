import { expect } from '@playwright/test';
import { MODULE_ID, test } from './fixtures/foundry-clients';

// Creates a world actor from the Adventure's stub under a new id, as a copy or duplicate would.
async function createFromStub({ slug, name }: { slug: string; name: string }): Promise<string> {
  const [adventure] = await game.packs.get('points-of-interest.adventure').getDocuments();
  const stub = adventure.toObject().actors.find((a: any) => a.flags['points-of-interest'].slug === slug);
  const { _id, ...data } = stub;
  return (await (window as any).Actor.create({ ...data, name })).id as string;
}

test.describe('actor hydration', () => {
  test.afterEach(async ({ gmPage }) => {
    await gmPage.evaluate(async () => {
      const ids = game.actors.filter((a: any) => a.name.startsWith('__e2e_')).map((a: any) => a.id);
      if (ids.length) await (window as any).Actor.deleteDocuments(ids);
    });
  });

  test('hydrates a stub created in the world, with its elite adjustment', async ({ gmPage }) => {
    const id = await gmPage.evaluate(createFromStub, { slug: '04-matriarch-gorm', name: '__e2e_Gorm' });
    await gmPage.waitForFunction((actorId) => !!game.actors.get(actorId)?.getFlag('points-of-interest', 'hydrated'), id);
    const actor = await gmPage.evaluate((actorId) => {
      const a = game.actors.get(actorId);
      return { name: a.name, items: a.items.size, elite: a.isElite, strikes: a.itemTypes.melee.length };
    }, id);
    expect(actor).toMatchObject({ name: '__e2e_Gorm', elite: true });
    expect(actor.items).toBeGreaterThan(3);
    expect(actor.strikes).toBeGreaterThan(0);
  });

  test("gives a hydrated butcher's axe strike the wounding rune", async ({ gmPage }) => {
    const id = await gmPage.evaluate(createFromStub, { slug: '06-grosh', name: '__e2e_Grosh' });
    await gmPage.waitForFunction((actorId) => !!game.actors.get(actorId)?.getFlag('points-of-interest', 'hydrated'), id);
    const runes = await gmPage.evaluate((actorId) => {
      const a = game.actors.get(actorId);
      const axe = a.itemTypes.weapon.find((w: any) => w.name === "Grosh's Battle Axe");
      const strike = a.itemTypes.melee.find((m: any) => m.flags.pf2e?.linkedWeapon === axe?.id);
      return { axe: axe?.system.runes.property ?? null, strike: strike?.system.runes?.property ?? null };
    }, id);
    expect(runes.axe).toContain('wounding');
    expect(runes.strike).toContain('wounding');
  });

  test('hydrates every actor during an Adventure import, in the import itself', async ({ gmPage }) => {
    const result = await gmPage.evaluate(async (moduleId) => {
      const imports = (window as any).foundry.utils.deepClone(game.settings.get('core', 'adventureImports'));
      const [adventure] = await game.packs.get(`${moduleId}.adventure`).getDocuments();
      const before = new Set(game.actors.map((a: any) => a.id));
      const folders = new Set(game.folders.map((f: any) => f.id));
      await adventure.import({ dialog: false, importFields: ['actors', 'folders'] });
      const imported = adventure.actors.map((a: any) => game.actors.get(a._id));
      const stubs = imported.filter((a: any) => a?.getFlag(moduleId, 'recipe') && !a.getFlag(moduleId, 'hydrated'));
      const report = { actors: imported.filter(Boolean).length, unhydrated: stubs.map((a: any) => a.name) };
      await (window as any).Actor.deleteDocuments(imported.filter((a: any) => a && !before.has(a.id)).map((a: any) => a.id));
      await (window as any).Folder.deleteDocuments(game.folders.filter((f: any) => !folders.has(f.id)).map((f: any) => f.id));
      await game.settings.set('core', 'adventureImports', imports);
      return report;
    }, MODULE_ID);
    expect(result.actors).toBe(102);
    expect(result.unhydrated).toEqual([]);
  });
});
