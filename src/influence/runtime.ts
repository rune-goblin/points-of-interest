import type {
  ArrayField,
  BooleanField,
  ModelPropsFromSchema,
  NumberField,
  SchemaField,
  SourceFromSchema,
  StringField,
} from 'foundry-pf2e/foundry/common/data/fields.mjs';
import { adventureContent } from '../adventure';
import { MODULE_ID } from '../constants';
import { GROUPS, playerView, type InfluenceData, type InfluenceState } from './model';

const FLAG = 'influence';

type Count = NumberField<number, number, true, false, true>;
type Text = StringField<string, string, true, false, true>;
type ItemSchema = { group: Text; text: Text };
type ViewSchema = {
  name: Text;
  img: Text;
  thresholds: ArrayField<Count>;
  rounds: NumberField<number, number, true, true, true>;
  items: ArrayField<SchemaField<ItemSchema>>;
};
type StateSchema = {
  shown: BooleanField;
  points: Count;
  round: Count;
  revealed: ArrayField<Text>;
  view: SchemaField<ViewSchema, SourceFromSchema<ViewSchema>, ModelPropsFromSchema<ViewSchema>, true, true, true>;
};

const { fields } = foundry.data;
const count = (min: number): Count => new fields.NumberField({ required: true, nullable: false, integer: true, min, initial: min });
const text = (): Text => new fields.StringField({ required: true, nullable: false, blank: true, initial: '' });

class InfluenceStateModel extends foundry.abstract.DataModel<null, StateSchema> {
  static override defineSchema(): StateSchema {
    return {
      shown: new fields.BooleanField({ initial: false }),
      points: count(0),
      round: count(1),
      revealed: new fields.ArrayField(text()),
      view: new fields.SchemaField(
        {
          name: text(),
          img: text(),
          thresholds: new fields.ArrayField(count(0)),
          rounds: new fields.NumberField({ required: true, nullable: true, integer: true, min: 1, initial: null }),
          items: new fields.ArrayField(
            new fields.SchemaField({ group: new fields.StringField({ required: true, nullable: false, choices: [...GROUPS], initial: 'skills' }), text: text() }),
          ),
        },
        { required: true, nullable: true, initial: null },
      ),
    };
  }
}

export async function influenceData(scene: Scene): Promise<InfluenceData | undefined> {
  const encounter = scene.getFlag(MODULE_ID, 'encounter');
  if (typeof encounter !== 'number') return undefined;
  const pages = (await adventureContent())?.journal.flatMap((entry) => entry.pages ?? []) ?? [];
  return pages.find((page) => page.flags?.[MODULE_ID]?.site === encounter)?.flags[MODULE_ID].influence;
}

export function readState(scene: Scene): InfluenceState {
  const flag = (scene.getFlag(MODULE_ID, FLAG) as object | undefined) ?? {};
  return new InfluenceStateModel(flag, { strict: false, fallback: true }).toObject() as InfluenceState;
}

let writes: Promise<unknown> = Promise.resolve();

// Writes queue because the scene's flag updates only once the server answers: two quick clicks
// would otherwise both read 0.
export function writeState(scene: Scene, data: InfluenceData, change: (state: InfluenceState) => Partial<InfluenceState>): Promise<unknown> {
  writes = writes.catch(() => undefined).then(() => {
    const current = readState(scene);
    const next = { ...current, ...change(current) };
    return scene.setFlag(MODULE_ID, FLAG, { ...next, view: playerView(data, next.revealed) });
  });
  return writes;
}

export async function resetState(scene: Scene, data: InfluenceData): Promise<void> {
  const t = (key: string) => game.i18n.format(`${MODULE_ID}.Influence.${key}`, { name: data.name });
  const reset = await foundry.applications.api.DialogV2.confirm({
    window: { title: t('ResetTitle') },
    content: `<p>${t('ResetPrompt')}</p>`,
  });
  if (reset) await scene.unsetFlag(MODULE_ID, FLAG);
}

export const changesInfluence = (changed: { flags?: Record<string, Record<string, unknown>> }): boolean =>
  !!changed.flags?.[MODULE_ID] && FLAG in changed.flags[MODULE_ID];
