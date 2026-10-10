import { MODULE_ID } from '../constants';

export const t = (key: string, values: Record<string, string | number> = {}): string =>
  game.i18n.format(
    `${MODULE_ID}.Influence.${key}`,
    Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)])),
  );
