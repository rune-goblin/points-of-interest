import type { Page } from '@playwright/test';
import { test, expect, joinAs, MODULE_ID } from './fixtures/foundry-clients';

const tracker = (page: Page) => page.locator(`#${MODULE_ID}-influence`);
const flag = (page: Page, sceneId: string) =>
  page.evaluate(({ id, scope }) => game.scenes.get(id).getFlag(scope, 'influence'), { id: sceneId, scope: MODULE_ID });

test.describe('Influence tracker', () => {
  let sceneId: string;
  let userId: string;
  let previous: string | null;
  let playerPage: Page;

  test.beforeAll(async ({ gmPage, browser }) => {
    ({ sceneId, userId, previous } = await gmPage.evaluate(async (scope) => {
      const w = window as any;
      const previous = game.scenes.active?.id ?? null;
      const scene = await w.Scene.create({ name: '__e2e_Influence', width: 1000, height: 1000, flags: { [scope]: { encounter: 2 } } });
      const user = await w.User.create({ name: '__e2e_Player', role: w.CONST.USER_ROLES.PLAYER });
      await scene.activate();
      return { sceneId: scene.id, userId: user.id, previous };
    }, MODULE_ID));
    playerPage = await (await browser.newContext()).newPage();
    await joinAs(playerPage, userId);
    await playerPage.addStyleTag({ content: '#notifications { display: none !important; }' });
  });

  test.afterAll(async ({ gmPage }) => {
    await playerPage.context().close();
    await gmPage.evaluate(async ({ sceneId, userId, previous }) => {
      if (previous) await game.scenes.get(previous)?.activate();
      await game.scenes.get(sceneId)?.delete();
      await game.users.get(userId)?.delete();
    }, { sceneId, userId, previous });
  });

  test('opens for the GM on a scene whose encounter has an Influence block, hidden from players', async ({ gmPage }) => {
    await expect(tracker(gmPage).getByRole('heading', { name: 'Maestra Ilsabet Rova' })).toBeVisible();
    await expect(tracker(gmPage).getByText('Round 1 of 6')).toBeVisible();
    await expect(tracker(gmPage).getByText('Rova orders the others to gather the scores')).toBeVisible();
    await expect(tracker(playerPage)).toHaveCount(0);
  });

  test('counts every click, even two in quick succession', async ({ gmPage }) => {
    const raise = tracker(gmPage).getByRole('button', { name: 'Raise Influence' });
    await raise.click();
    await raise.click();
    await expect(tracker(gmPage).locator('output')).toHaveText('2');
    expect(await flag(gmPage, sceneId)).toMatchObject({ points: 2 });
  });

  test('shares the tracker and only the entries the GM reveals', async ({ gmPage }) => {
    await tracker(gmPage).getByRole('button', { name: 'Show players' }).click();
    await expect(tracker(playerPage).getByRole('heading', { name: 'Maestra Ilsabet Rova' })).toBeVisible();
    await expect(tracker(playerPage).locator('output')).toHaveText('2');
    await expect(tracker(playerPage).getByText('Nothing discovered yet.')).toBeVisible();
    await expect(tracker(playerPage).getByRole('button')).toHaveCount(1);

    await tracker(gmPage).getByRole('button', { name: /^DC 34 Diplomacy$/ }).click();
    await expect(tracker(playerPage).getByText('DC 34 Diplomacy')).toBeVisible();
    await expect(tracker(playerPage).getByText('Influence skills')).toBeVisible();
    await expect(tracker(playerPage).getByText('Rova orders the others')).toHaveCount(0);
    await expect(tracker(playerPage).getByText('DC 36 Deception')).toHaveCount(0);

    await tracker(gmPage).getByRole('button', { name: 'Next round' }).click();
    await expect(tracker(playerPage).getByText('Round 2 of 6')).toBeVisible();
  });

  test('closes for players when the GM hides it, and resets on the GM\'s confirmation', async ({ gmPage }) => {
    await tracker(gmPage).getByRole('button', { name: 'Hide from players' }).click();
    await expect(tracker(playerPage)).toHaveCount(0);

    await tracker(gmPage).getByRole('button', { name: 'Reset the tracker' }).click();
    await gmPage.getByRole('button', { name: 'Yes' }).click();
    await expect(tracker(gmPage).locator('output')).toHaveText('0');
    await expect(tracker(gmPage).getByText('Round 1 of 6')).toBeVisible();
    expect(await flag(gmPage, sceneId)).toBeUndefined();
  });
});
