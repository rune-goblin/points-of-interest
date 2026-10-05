// Delete everything this module put in a world, straight from the world's databases, so the Adventure
// imports fresh: `npm run remove-module`, which asks for the world and confirms before deleting.
// `-- <world>` names the world, `--dry-run` only lists the content, `--yes` skips the questions.
// Foundry must have that world closed.
//
// It removes the documents the Adventure imports and any other document flagged `points-of-interest`
// (such as the per-site journal entries of releases up to 0.2.0), each with its embedded documents; the
// combats and fog of the deleted scenes; the King's map notes on the scenes that stay; the module's world
// settings; and Foundry's record of the import, so the importer opens on the next load. Anything else
// filed in a deleted folder moves up to the nearest surviving one, as Foundry does when a folder goes.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { ClassicLevel } from 'classic-level';
import { detectFoundryData } from './foundry-data.ts';
import { MODULE_ID } from './stable-id.ts';

type Doc = Record<string, any>;
type Db = ClassicLevel<string, Doc>;
type Op = { type: 'del'; key: string } | { type: 'put'; key: string; value: Doc };

const SOURCE = join(process.cwd(), 'packs', '_source');
// The Adventure's collections; a world keeps each in a database of the same name.
const CONTENT = ['folders', 'actors', 'items', 'journal', 'scenes', 'macros', 'tables', 'playlists', 'cards'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const interactive = Boolean(stdin.isTTY) && !args.includes('--yes');
const foundryData = detectFoundryData();
if (!foundryData) {
  console.error('No Foundry data dir found — run `npm run setup`, set FOUNDRY_DATA, or create .dev-paths.json.');
  process.exit(1);
}
const worlds = join(foundryData, 'worlds');

function cancel(): never {
  console.log('\nNothing deleted.');
  process.exit(0);
}

let rl: ReturnType<typeof createInterface> | undefined;
async function ask(question: string): Promise<string> {
  rl ??= createInterface({ input: stdin, output: stdout }).on('SIGINT', cancel);
  try {
    return (await rl.question(question)).trim();
  } catch {
    // Ctrl+D rejects the question.
    cancel();
  }
}

function titleOf(world: string): string {
  try {
    return (JSON.parse(readFileSync(join(worlds, world, 'world.json'), 'utf8')) as { title?: string }).title ?? world;
  } catch {
    return world;
  }
}

async function chooseWorld(): Promise<string> {
  const ids = existsSync(worlds)
    ? readdirSync(worlds, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(worlds, d.name, 'data'))).map((d) => d.name)
    : [];
  if (!ids.length) {
    console.error(`No worlds in ${worlds}.`);
    process.exit(1);
  }
  if (!interactive) {
    console.error(`Name the world: npm run remove-module -- <world>. Worlds: ${ids.join(', ')}`);
    process.exit(1);
  }
  ids.forEach((id, i) => console.log(`  ${i + 1}. ${titleOf(id)} (${id})`));
  const answer = await ask(`World to clear (1-${ids.length}): `);
  const world = ids[Number(answer) - 1] ?? ids.find((id) => id === answer);
  if (!world) {
    console.error(`No world "${answer}".`);
    process.exit(1);
  }
  return world;
}

const world = args.find((arg) => !arg.startsWith('--')) ?? (await chooseWorld());
const title = titleOf(world);
const dataDir = join(worlds, world, 'data');
if (!existsSync(dataDir)) {
  console.error(`No world "${world}" in ${worlds}.`);
  process.exit(1);
}

function adventureIds(): Map<string, Set<string>> {
  const ids = new Map<string, Set<string>>();
  for (const dir of readdirSync(SOURCE, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name === '_library') continue;
    for (const file of readdirSync(join(SOURCE, dir.name)).filter((f) => f.endsWith('.json'))) {
      const { _key } = JSON.parse(readFileSync(join(SOURCE, dir.name, file), 'utf8')) as { _key: string };
      const [, collection, id] = _key.split('!');
      ids.set(collection, (ids.get(collection) ?? new Set()).add(id));
    }
  }
  return ids;
}

async function openAll(): Promise<Map<string, Db>> {
  const dbs = new Map<string, Db>();
  const names = readdirSync(dataDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dataDir, d.name, 'CURRENT')))
    .map((d) => d.name);
  for (const name of names) {
    const db = new ClassicLevel<string, Doc>(join(dataDir, name), { valueEncoding: 'json', createIfMissing: false });
    try {
      await db.open();
    } catch (error) {
      for (const open of dbs.values()) await open.close();
      if ((error as { cause?: { code?: string } }).cause?.code !== 'LEVEL_LOCKED') throw error;
      console.error(`Foundry has ${title} open. Return to Setup or quit Foundry, then run this again.`);
      process.exit(1);
    }
    dbs.set(name, db);
  }
  return dbs;
}

async function topLevel(db: Db, collection: string): Promise<Map<string, Doc>> {
  const docs = new Map<string, Doc>();
  for await (const [key, doc] of db.iterator({ gt: `!${collection}!`, lt: `!${collection}!~` })) {
    docs.set(key.slice(collection.length + 2), doc);
  }
  return docs;
}

// Embedded keys read `!<collection>.<field>!<parent id>.<id>`, so a document's own key and its
// embedded documents' keys all carry its id first.
async function keysOf(db: Db, ids: Set<string>): Promise<string[]> {
  const keys: string[] = [];
  for await (const key of db.keys()) {
    if (ids.has(key.split('!')[2]?.split('.')[0] ?? '')) keys.push(key);
  }
  return keys;
}

const dbs = await openAll();
const adventure = adventureIds();
const top = new Map<string, Map<string, Doc>>();
for (const collection of [...CONTENT, 'combats', 'fog', 'settings']) {
  const db = dbs.get(collection);
  if (db) top.set(collection, await topLevel(db, collection));
}

const removed = new Map<string, Set<string>>();
for (const collection of CONTENT) {
  const listed = adventure.get(collection) ?? new Set();
  const ids = [...(top.get(collection) ?? [])].filter(([id, doc]) => listed.has(id) || MODULE_ID in (doc.flags ?? {})).map(([id]) => id);
  if (ids.length) removed.set(collection, new Set(ids));
}
const deletedScenes = removed.get('scenes') ?? new Set();
for (const collection of ['combats', 'fog']) {
  const ids = [...(top.get(collection) ?? [])].filter(([, doc]) => deletedScenes.has(doc.scene)).map(([id]) => id);
  if (ids.length) removed.set(collection, new Set(ids));
}

const writes = new Map<string, Op[]>();
const write = (collection: string) => {
  if (!writes.has(collection)) writes.set(collection, []);
  return writes.get(collection)!;
};
const report: string[] = [];

for (const [collection, ids] of removed) {
  for (const key of await keysOf(dbs.get(collection)!, ids)) write(collection).push({ type: 'del', key });
  report.push(`${collection}: ${ids.size}`);
}

let siteNotes = 0;
const scenesDb = dbs.get('scenes');
if (scenesDb) {
  const notes = new Map<string, string[]>();
  for await (const [key, note] of scenesDb.iterator({ gt: '!scenes.notes!', lt: '!scenes.notes!~' })) {
    const [sceneId, noteId] = key.split('!')[2].split('.');
    if (deletedScenes.has(sceneId) || note.flags?.[MODULE_ID]?.site === undefined) continue;
    notes.set(sceneId, [...(notes.get(sceneId) ?? []), noteId]);
    write('scenes').push({ type: 'del', key });
  }
  for (const [sceneId, noteIds] of notes) {
    const scene = top.get('scenes')!.get(sceneId)!;
    write('scenes').push({ type: 'put', key: `!scenes!${sceneId}`, value: { ...scene, notes: scene.notes.filter((id: string) => !noteIds.includes(id)) } });
    siteNotes += noteIds.length;
    report.push(`King's map notes on ${scene.name}: ${noteIds.length}`);
  }
}

const deletedFolders = removed.get('folders') ?? new Set();
const folderDocs = top.get('folders') ?? new Map();
const survivingFolder = (id: string | null): string | null => {
  while (id && deletedFolders.has(id)) id = folderDocs.get(id)?.folder ?? null;
  return id;
};
let moved = 0;
for (const collection of CONTENT) {
  for (const [id, doc] of top.get(collection) ?? []) {
    if (removed.get(collection)?.has(id) || !deletedFolders.has(doc.folder)) continue;
    write(collection).push({ type: 'put', key: `!${collection}!${id}`, value: { ...doc, folder: survivingFolder(doc.folder) } });
    moved++;
  }
}
if (moved) report.push(`documents moved out of deleted folders: ${moved}`);

for (const [id, setting] of top.get('settings') ?? []) {
  const key = `!settings!${id}`;
  if (setting.key?.startsWith(`${MODULE_ID}.`)) {
    write('settings').push({ type: 'del', key });
    report.push(`setting ${setting.key}`);
  } else if (setting.key === 'core.adventureImports') {
    const imports = JSON.parse(setting.value ?? '{}') as Record<string, unknown>;
    const ours = Object.keys(imports).filter((uuid) => uuid.startsWith(`Compendium.${MODULE_ID}.`));
    if (!ours.length) continue;
    for (const uuid of ours) delete imports[uuid];
    write('settings').push({ type: 'put', key, value: { ...setting, value: JSON.stringify(imports) } });
    report.push('the record of the Adventure import');
  }
}

async function confirmed(): Promise<boolean> {
  if (!report.length) {
    console.log(`${title} holds no Points of Interest content.`);
    return false;
  }
  console.log(`Points of Interest content in ${title}:\n  ${report.join('\n  ')}`);
  if (dryRun) {
    console.log('Dry run: nothing deleted.');
    return false;
  }
  if (interactive && !/^y(es)?$/i.test(await ask('Delete it? (y/N) '))) cancel();
  return true;
}

const remove = await confirmed();
if (remove) for (const [collection, ops] of writes) await dbs.get(collection)!.batch(ops);
for (const db of dbs.values()) await db.close();
rl?.close();
if (remove) {
  console.log(`Deleted. Launch ${title} and import the Adventure.${siteNotes ? ' Then run "Place the King\'s Map Notes" to put the map notes back.' : ''}`);
}
