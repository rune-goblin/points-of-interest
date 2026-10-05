import { marked, type Token } from 'marked';
import { slugify } from './stable-id.ts';

export interface Renderers {
  block: (md: string) => string;
  inline: (md: string) => string;
}

export interface EncounterParts {
  facts: string;
  caption?: string;
  body: string;
}

const NOTE_LABEL = "The King's map note";
const SECTION = /^\*\*([^*\n]+?)\.\*\*[ \t]*/;
const SUBSECTION = /^\*([^*\n]+?)\.\*[ \t]*/;
const STAT_HEAD = /^\*\*([^*\n]+)\*\* — (HAZARD|CREATURE) (\d+)\s*$/;
const CARD_HEAD = /^(\*\*?)([^*\n]+?)\1(?: \(([^)\n]*)\))?\s*$/;

const SKILLS = 'Acrobatics|Arcana|Athletics|Crafting|Deception|Diplomacy|Intimidation|Medicine|Nature|Occultism|Performance|Religion|Society|Stealth|Survival|Thievery|Perception';
const STATISTIC = String.raw`(?:${SKILLS}|Fortitude|Reflex|Will|(?:[A-Z][a-z]+(?:-[A-Z][a-z]+)* )+Lore)`;
const STATISTICS = String.raw`${STATISTIC}(?:(?:,? or |, )${STATISTIC})*`;
const DC_FIRST = new RegExp(String.raw`\bDC (\d+) (basic )?(${STATISTICS})`, 'g');
const DC_LAST = new RegExp(String.raw`\b(${STATISTICS}),? DC (\d+)\b`, 'g');

// Inside a markdown table row a bare pipe would split the cell.
function checkLinks(names: string, dc: string, basic: boolean, pipe: string): string {
  return names
    .split(/(,? or |, )/)
    .map((part, i) => (i % 2 ? part : `@Check[${slugify(part)}${pipe}dc:${dc}${basic ? `${pipe}basic` : ''}]`))
    .join('');
}

/**
 * Turns "DC 36 Religion", "DC 35 basic Reflex" and "Society or Crafting, DC 36" into PF2e inline
 * checks, which a GM can roll or post to chat. Read-aloud lines stay as written.
 */
export function linkChecks(md: string): string {
  return md
    .split('\n')
    .map((line) => {
      if (line.startsWith('>')) return line;
      const pipe = line.startsWith('|') ? '\\|' : '|';
      return line
        .replace(DC_FIRST, (_, dc: string, basic: string | undefined, names: string) => checkLinks(names, dc, !!basic, pipe))
        .replace(DC_LAST, (_, names: string, dc: string) => checkLinks(names, dc, false, pipe));
    })
    .join('\n');
}

const ICONS: Record<string, string> = {
  sites: 'fa-route',
  background: 'fa-scroll',
  arrival: 'fa-comment-dots',
  features: 'fa-map-location-dot',
  'running-the-encounter': 'fa-chess-knight',
  'influence-per-bloc': 'fa-handshake',
  combat: 'fa-swords',
  twist: 'fa-shuffle',
  outcomes: 'fa-code-branch',
  rewards: 'fa-coins',
  scaling: 'fa-sliders',
};

const SMALL_WORDS = new Set(['a', 'an', 'and', 'of', 'the', 'to', 'in', 'on', 'at', 'for']);
const titleCase = (caps: string): string =>
  caps
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The Pathfinder2eActions font PF2e loads draws 1/2/3/R/F as its action icons.
const GLYPHS: [RegExp, string][] = [
  [/◆◆◆/g, '3'],
  [/◆◆/g, '2'],
  [/◆/g, '1'],
  [/↺/g, 'R'],
  [/◇/g, 'F'],
];
const actionGlyphs = (html: string): string =>
  GLYPHS.reduce((out, [re, glyph]) => out.replace(re, `<span class="action-glyph">${glyph}</span>`), html);

const markLeads = (html: string): string => html.replace(/<li><strong>/g, '<li><strong class="poi-term">');

const blocks = (md: string): Token[] => marked.lexer(md).filter((t) => t.type !== 'space');

function statBlock(raws: string[], render: Renderers['block']): string {
  const lines = raws.join('\n\n').split(/\n+/).filter((l) => l.trim());
  const [, name, kind, level] = lines[0].match(STAT_HEAD)!;
  const traitLine = lines[1] && !lines[1].startsWith('**') && lines[1] !== '---' ? lines[1] : undefined;
  const traits = (traitLine ?? '')
    .split(/,\s*/)
    .filter(Boolean)
    .map((t) => `<span data-trait="${slugify(t)}">${escapeHtml(t)}</span>`)
    .join('');
  const rest = lines.slice(traitLine ? 2 : 1).join('\n\n');
  return (
    `<section class="poi-card poi-stat"><header class="poi-card-head">` +
    `<h3 data-no-toc>${escapeHtml(titleCase(name))}</h3><span class="poi-card-tag">${titleCase(kind)} ${level}</span></header>` +
    (traits ? `<p class="poi-traits">${traits}</p>` : '') +
    `<div class="poi-card-body">${render(rest)}</div></section>`
  );
}

function card(name: string, aside: string | undefined, listMd: string, render: Renderers['block']): string {
  const paren = name.match(/^(.*?)\s*\(([^)]*)\)$/);
  const prefixed = name.match(/^(Influence): (.*)$/);
  const [rawTitle, kind] = paren ? [paren[1], paren[2]] : prefixed ? [prefixed[2], prefixed[1]] : [name, undefined];
  const title = rawTitle.replace(/^./, (c) => c.toUpperCase());
  const tag = [kind, aside].filter(Boolean).join(' · ');
  const list = render(listMd).replace(/<li><strong>(Influence \d+):?<\/strong>:?/g, '<li class="poi-threshold"><strong>$1</strong>');
  return (
    `<section class="poi-card poi-influence"><header class="poi-card-head"><h3 data-no-toc>${escapeHtml(title)}</h3>` +
    `${tag ? `<span class="poi-card-tag">${escapeHtml(tag)}</span>` : ''}</header>` +
    `<div class="poi-card-body">${list}</div></section>`
  );
}

// "60 XP …. Treasure: …. Kingdom: …" reads as a ledger: one row per kind of reward.
function rewardLedger(md: string, inline: Renderers['inline']): string | undefined {
  const parts = md.trim().split(/(?<=[.;!?]\s)(?=(?:Treasure|Kingdom)\b)/);
  if (parts.length < 2) return undefined;
  const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const rows = parts.map((part) => {
    const text = part.trim();
    if (text.startsWith('Kingdom')) return ['Kingdom', text.replace(/^Kingdom(?: benefit)?:\s*/, '')];
    if (!text.startsWith('Treasure')) return ['XP', text];
    const qualified = text.match(/^Treasure \(([^)]+)\):\s*/);
    if (qualified) return ['Treasure', `${capital(qualified[1])}: ${text.slice(qualified[0].length)}`];
    const lead = text.match(/^Treasure (?:is |are )?(?=inside|in|at|on|under\b)/);
    if (lead) return ['Treasure', capital(text.slice(lead[0].length))];
    return ['Treasure', text.replace(/^Treasure:\s*/, '')];
  });
  return `<dl class="poi-ledger">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${inline(capital(v))}</dd></div>`).join('')}</dl>`;
}

interface Section { label?: string; raws: string[]; html: string[] }

function sectionHtml(section: Section, render: Renderers['block']): string {
  const flush = section.raws.length ? render(section.raws.join('\n\n')) : '';
  const content = actionGlyphs(markLeads(section.html.join('') + flush));
  if (!content.trim() && !section.label) return '';
  const slug = section.label ? slugify(section.label) : 'intro';
  const kind = slug.startsWith('arrival') ? 'arrival' : slug;
  const heading = section.label
    ? `<h2 class="poi-h" data-no-toc><i class="fa-solid ${ICONS[kind] ?? 'fa-bookmark'}" aria-hidden="true"></i><span>${escapeHtml(section.label)}</span></h2>`
    : '';
  return `<section class="poi-sec poi-sec--${kind}">${heading}<div class="poi-sec-body">${content}</div></section>`;
}

/**
 * Sections open at a run-in label ("**Rewards.** …") or, on the overview, at a `##` heading.
 * Rendered HTML collects in `html`; markdown still waiting to render collects in `raws`, so
 * consecutive plain blocks render together and keep their list and paragraph spacing.
 */
function sections(tokens: Token[], { block: render, inline }: Renderers): string {
  const out: Section[] = [{ raws: [], html: [] }];
  const current = () => out.at(-1)!;
  const flush = () => {
    const s = current();
    if (s.raws.length) s.html.push(render(s.raws.splice(0).join('\n\n')));
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const raw = token.raw.trim();
    if (token.type === 'heading' && token.depth === 2) {
      out.push({ label: token.text, raws: [], html: [] });
      continue;
    }
    if (token.type !== 'paragraph') {
      current().raws.push(raw);
      continue;
    }
    const label = raw.match(SECTION);
    if (label) {
      out.push({ label: label[1], raws: [], html: [] });
      const rest = raw.slice(label[0].length).trim();
      if (label[1] === 'Rewards' && rest) {
        const ledger = rewardLedger(rest, inline);
        if (ledger) current().html.push(ledger);
        else current().raws.push(rest);
      } else if (rest) {
        current().raws.push(rest);
      }
      continue;
    }
    if (STAT_HEAD.test(raw.split('\n')[0])) {
      flush();
      const stat = [raw];
      const continues = (t?: Token) =>
        !!t && (t.type === 'hr' || (t.type === 'paragraph' && !SECTION.test(t.raw) && /^\*\*|^[A-Z][a-z]+, /.test(t.raw)));
      while (continues(tokens[i + 1])) stat.push(tokens[++i].raw.trim());
      current().html.push(statBlock(stat, render));
      continue;
    }
    const sub = raw.match(SUBSECTION);
    if (sub) {
      flush();
      current().html.push(`<h3 class="poi-sub" data-no-toc>${escapeHtml(sub[1])}</h3>`);
      const rest = raw.slice(sub[0].length).trim();
      if (rest) current().raws.push(rest);
      continue;
    }
    const head = raw.match(CARD_HEAD);
    if (head && tokens[i + 1]?.type === 'list') {
      flush();
      current().html.push(card(head[2], head[3], tokens[++i].raw.trim(), render));
      continue;
    }
    current().raws.push(raw);
  }
  return out.map((s) => sectionHtml(s, render)).join('\n');
}

export function encounterParts(md: string, renderers: Renderers): EncounterParts {
  const tokens = blocks(linkChecks(md));
  const tableAt = tokens.findIndex((t) => t.type === 'table');
  const facts = tableAt < 0 ? '' : renderers.block(tokens[tableAt].raw).replace('<table>', '<table class="poi-facts">');
  const rest = tokens.filter((_, i) => i !== tableAt);
  let caption: string | undefined;
  const noteAt = rest.findIndex((t) => t.type === 'paragraph' && t.raw.match(SECTION)?.[1] === NOTE_LABEL);
  if (noteAt >= 0) {
    caption = renderers.inline(rest[noteAt].raw.trim().replace(SECTION, ''));
    rest.splice(noteAt, 1);
  }
  return { facts, caption, body: `<div class="poi-body">${sections(rest, renderers)}</div>` };
}

export function overviewHtml(md: string, renderers: Renderers): string {
  return `<div class="poi-body">${sections(blocks(md), renderers)}</div>`;
}
