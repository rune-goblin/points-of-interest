import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from './fixtures/foundry-clients';

const source = JSON.parse(readFileSync(join(process.cwd(), 'packs/_source/journals/points-of-interest.json'), 'utf8'));
const content = source.pages.find((p: any) => p.flags['points-of-interest']?.site === 1).text.content as string;

test.describe('journal banner actions', () => {
  let journalId: string;
  let sceneId: string;
  let previousScene: string | null;

  test.beforeAll(async ({ gmPage }) => {
    const created = await gmPage.evaluate(async (html) => {
      const previous = game.scenes.viewed?.id ?? null;
      const scene = await (window as any).Scene.create({ name: '__e2e_Journal scene', width: 1000, height: 1000 });
      const journal = await (window as any).JournalEntry.create({
        name: '__e2e_Journal banner',
        pages: [{ name: 'The Shadowless Lodge', type: 'text', text: {
          format: 1, content: html.replace(/data-scene="[^"]+"/g, `data-scene="${scene.id}"`),
        } }],
      });
      return { journal: journal.id, scene: scene.id, previous };
    }, content);
    journalId = created.journal;
    sceneId = created.scene;
    previousScene = created.previous;
  });

  test.beforeEach(async ({ gmPage }) => {
    await gmPage.evaluate(async (id) => {
      const journal = game.journal.get(id);
      await journal.sheet.render({ force: true, pageId: journal.pages.contents[0].id });
    }, journalId);
    await expect(gmPage.locator('.poi-scene-art').first()).toBeVisible();
  });

  test.afterAll(async ({ gmPage }) => {
    await gmPage.evaluate(async ({ journalId, sceneId, previousScene }) => {
      const journal = game.journal.get(journalId);
      await journal?.sheet.close();
      await journal?.delete();
      if (previousScene) await game.scenes.get(previousScene)?.view();
      await game.scenes.get(sceneId)?.delete();
    }, { journalId, sceneId, previousScene });
  });

  test('expands the establishing image and returns to the journal on Escape', async ({ gmPage }) => {
    await gmPage.locator('.poi-scene-art img').first().click();
    const dialog = gmPage.locator('.points-of-interest-lightbox dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('img')).toHaveAttribute('src', /assets\/establishing\/01-shadowless-lodge.webp$/);
    const dimensions = await dialog.boundingBox();
    expect(dimensions?.width).toBe(gmPage.viewportSize()!.width);
    expect(dimensions?.height).toBe(gmPage.viewportSize()!.height);
    await gmPage.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(gmPage.locator('.poi-masthead')).toBeVisible();
  });

  test('shows the tactical map without changing scenes', async ({ gmPage }) => {
    const viewed = await gmPage.evaluate(() => game.scenes.viewed?.id ?? null);
    await gmPage.getByRole('button', { name: 'Show map: The Shadowless Lodge', exact: true }).click();
    const dialog = gmPage.locator('.points-of-interest-lightbox dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('img')).toHaveAttribute('src', /assets\/maps\/01-shadowless-lodge.webp$/);
    expect(await gmPage.evaluate(() => game.scenes.viewed?.id ?? null)).toBe(viewed);
    await dialog.getByRole('button', { name: 'Close the image' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('opens the scene from the keyboard without opening a lightbox', async ({ gmPage }) => {
    const button = gmPage.getByRole('button', { name: 'Open scene: The Shadowless Lodge', exact: true });
    await button.focus();
    await button.press('Enter');
    await expect.poll(() => gmPage.evaluate(() => game.scenes.viewed?.id)).toBe(sceneId);
    await expect(gmPage.locator('.points-of-interest-lightbox')).toHaveCount(0);
  });

  test('keeps the note, facts, and numbered outcomes inside a narrow journal pane', async ({ gmPage }) => {
    const page = gmPage.locator('.journal-page-content:has(.poi-masthead)');
    await page.evaluate((el) => { (el as HTMLElement).style.width = '300px'; });
    await page.locator('.poi-reference > summary').click();
    await expect(page.locator('.poi-note img')).toBeVisible();
    await expect(page.locator('.poi-facts')).toBeVisible();
    await expect(page.locator('ol.poi-outcomes > li')).toHaveCount(4);
    expect(await page.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  });
});
