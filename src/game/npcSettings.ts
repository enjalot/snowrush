export interface NpcSettings {
  count: number;
  awareness: number;
  aggression: number;
  trickiness: number;
}

export type NpcSettingKey = keyof NpcSettings;

export interface NpcSettingControl {
  key: NpcSettingKey;
  label: string;
  min: number;
  max: number;
  hint: string;
}

const STORAGE_KEY = 'snowrush.npcSettings';

export const DEFAULT_NPC_SETTINGS: NpcSettings = {
  count: 5,
  awareness: 68,
  aggression: 52,
  trickiness: 60,
};

export const NPC_SETTING_CONTROLS: NpcSettingControl[] = [
  { key: 'count', label: 'Rival Count', min: 0, max: 10, hint: 'How many NPC riders spawn into the race.' },
  { key: 'awareness', label: 'Awareness', min: 10, max: 100, hint: 'How early rivals react to obstacles, crowding, and future threats.' },
  { key: 'aggression', label: 'Aggression', min: 0, max: 100, hint: 'Higher values make rivals hold contested lines and pressure openings.' },
  { key: 'trickiness', label: 'Trickiness', min: 0, max: 100, hint: 'Higher values make rivals chase ramps and commit harder to tricks.' },
];

function sanitizeNpcSettings(value: unknown): NpcSettings {
  const raw = (value && typeof value === 'object')
    ? value as Partial<Record<NpcSettingKey, unknown>>
    : {};
  const next = { ...DEFAULT_NPC_SETTINGS };

  for (const control of NPC_SETTING_CONTROLS) {
    const candidate = raw[control.key];
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
      continue;
    }

    const wholeNumber = Math.round(candidate);
    next[control.key] = Math.max(control.min, Math.min(control.max, wholeNumber));
  }

  return next;
}

export function getStoredNpcSettings(): NpcSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_NPC_SETTINGS };
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return { ...DEFAULT_NPC_SETTINGS };
  }

  try {
    return sanitizeNpcSettings(JSON.parse(rawValue));
  } catch {
    return { ...DEFAULT_NPC_SETTINGS };
  }
}

export function saveNpcSettings(settings: NpcSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeNpcSettings(settings)));
}
