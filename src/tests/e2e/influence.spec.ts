import type { Locator, Page } from '@playwright/test';
import { test, expect, joinAs, MODULE_ID } from './fixtures/foundry-clients';

const tracker = (page: Page) => page.locator(`#${MODULE_ID}-influence`);
const entry = (page: Page, text: string) => tracker(page).getByRole('listitem').filter({ has: page.getByText(text, { exact: true }) });
const flag = (page: Page, sceneId: string) =>
  page.evaluate(({ id, scope }) => game.scenes.get(id).getFlag(scope, 'influence'), { id: sceneId, scope: MODULE_ID });

test.describe('Influence tracker', () => {
  let sceneId: string;
  let userId: string;
  let previous: string | null;
  let playerPage: Page;
  let importer: Locator;

  test.beforeAll(async ({ gmPage, browser }) => {
    ({ sceneId, userId, previous } = await gmPage.evaluate(async (scope) => {
      const w = window as any;
      const previous = game.scenes.active?.id ?? null;
      const scene = await w.Scene.create({ name: '__e2e_Influence', width: 1000, height: 1000, flags: { [scope]: { encounter: 2 } } });
      const user = await w.User.create({ name: '__e2e_Player', role: w.CONST.USER_ROLES.PLAYER });
      await scene.activate();
      return { sceneId: scene.id, userId: user.id, previous };
    }, MODULE_ID));
    // A world without the Adventure imported opens the import prompt over the tracker, a few seconds after login.
    importer = gmPage.locator('.adventure-importer');
    await gmPage.addLocatorHandler(importer, (prompt) => prompt.locator('.header-button.close').click());
    playerPage = await (await browser.newContext()).newPage();
    await joinAs(playerPage, userId);
    await playerPage.addStyleTag({ content: '#notifications { display: none !important; }' });
  });

  test.afterAll(async ({ gmPage }) => {
    await playerPage.context().close();
    await gmPage.removeLocatorHandler(importer);
    await gmPage.evaluate(async ({ sceneId, userId, previous }) => {
      if (previous) await game.scenes.get(previous)?.activate();
      await game.scenes.get(sceneId)?.delete();
      await game.users.get(userId)?.delete();
    }, { sceneId, userId, previous });
  });

  test('opens for the GM with the stat block on a scene whose encounter has an Influence block, hidden from players', async ({ gmPage }) => {
    await expect(tracker(gmPage).getByRole('heading', { name: 'Maestra Ilsabet Rova' })).toBeVisible();
    await expect(tracker(gmPage).getByText('human composer and leader, level 11')).toBeVisible();
    await expect(tracker(gmPage).getByText('Round 1 of 3')).toBeVisible();
    await expect(tracker(gmPage).getByText('+18; Will +16')).toBeVisible();
    await expect(tracker(gmPage).getByText('Rova orders the others to gather the scores')).toBeVisible();
    await expect(tracker(gmPage).getByText(/^Praise of the composition/)).toBeVisible();
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

    await entry(gmPage, 'DC 34 Diplomacy').getByRole('button', { name: 'Reveal this entry to players' }).click();
    await expect(tracker(playerPage).getByText('DC 34 Diplomacy')).toBeVisible();
    await expect(tracker(playerPage).getByText('Influence skills')).toBeVisible();
    await expect(tracker(playerPage).getByText('Rova orders the others')).toHaveCount(0);
    await expect(tracker(playerPage).getByText('DC 36 Deception')).toHaveCount(0);

    await tracker(gmPage).getByRole('button', { name: 'Next round' }).click();
    await expect(tracker(playerPage).getByText('Round 2 of 3')).toBeVisible();
  });

  test('previews the player view for the GM', async ({ gmPage }) => {
    await tracker(gmPage).getByRole('button', { name: 'Player view' }).click();
    await expect(tracker(gmPage).getByText('DC 34 Diplomacy')).toBeVisible();
    await expect(tracker(gmPage).getByText('Rova orders the others')).toHaveCount(0);
    await expect(tracker(gmPage).getByRole('button', { name: 'Raise Influence' })).toHaveCount(0);
    await tracker(gmPage).getByRole('button', { name: 'GM view' }).click();
    await expect(tracker(gmPage).getByRole('button', { name: 'Raise Influence' })).toBeVisible();
  });

  test('posts a check to chat that players can roll, with its DC shown', async ({ gmPage }) => {
    await entry(gmPage, 'DC 34 Diplomacy').getByRole('button', { name: 'Post the check to chat' }).click();
    const check = playerPage.locator('[data-message-id] a.inline-check[data-pf2-check="diplomacy"]').last();
    await expect(check).toContainText('DC 34');
    await expect(check).toHaveAttribute('data-pf2-traits', 'concentrate,linguistic');
    await gmPage.evaluate(async () => {
      const posted = game.messages.contents.filter((m) => m.content.includes('@Check[diplomacy|dc:34|showDC:all'));
      await ChatMessage.deleteDocuments(posted.map((m) => m.id));
    });
  });

  test('closes for players when the GM hides it, and resets on the GM\'s confirmation', async ({ gmPage }) => {
    await tracker(gmPage).getByRole('button', { name: 'Hide from players' }).click();
    await expect(tracker(playerPage)).toHaveCount(0);

    await tracker(gmPage).getByRole('button', { name: 'Reset the tracker' }).click();
    await gmPage.getByRole('button', { name: 'Yes' }).click();
    await expect(tracker(gmPage).locator('output')).toHaveText('0');
    await expect(tracker(gmPage).getByText('Round 1 of 3')).toBeVisible();
    expect(await flag(gmPage, sceneId)).toBeUndefined();
  });
});
