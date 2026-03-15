export interface PhysicsSettings {
  gravity: number;
  acceleration: number;
  slopeAccel: number;
  maxSpeed: number;
  turnSpeed: number;
  drag: number;
  popForce: number;
}

export interface ResolvedPhysicsSettings {
  gravity: number;
  acceleration: number;
  slopeAccel: number;
  maxSpeed: number;
  turnSpeed: number;
  drag: number;
  popForce: number;
}

export type PhysicsSettingKey = keyof PhysicsSettings;

export interface PhysicsSettingControl {
  key: PhysicsSettingKey;
  label: string;
  min: number;
  max: number;
  hint: string;
  unit?: string;
}

const STORAGE_KEY = 'snowrush.physicsSettings';

export const DEFAULT_PHYSICS_SETTINGS: PhysicsSettings = {
  gravity: 20,
  acceleration: 8,
  slopeAccel: 6,
  maxSpeed: 60,
  turnSpeed: 25,
  drag: 30,
  popForce: 25,
};

export const PHYSICS_SETTING_CONTROLS: PhysicsSettingControl[] = [
  { key: 'gravity', label: 'Gravity', min: 10, max: 40, hint: 'Higher values pull you back to the snow faster.' },
  { key: 'acceleration', label: 'Acceleration', min: 2, max: 16, hint: 'How hard forward input adds speed.' },
  { key: 'slopeAccel', label: 'Slope Pull', min: 2, max: 14, hint: 'How much the hill itself speeds you up.' },
  { key: 'maxSpeed', label: 'Max Speed', min: 30, max: 90, hint: 'Top-end downhill pace before the cap kicks in.' },
  { key: 'turnSpeed', label: 'Turn Response', min: 10, max: 40, hint: 'Higher values carve harder with the same steer input.' },
  { key: 'drag', label: 'Drag', min: 5, max: 60, hint: 'Higher values bleed speed faster.', unit: '%' },
  { key: 'popForce', label: 'Air Pop', min: 10, max: 45, hint: 'Lift from a pump release or pop.' },
];

export function resolvePhysicsSettings(settings: PhysicsSettings): ResolvedPhysicsSettings {
  return {
    gravity: settings.gravity,
    acceleration: settings.acceleration,
    slopeAccel: settings.slopeAccel,
    maxSpeed: settings.maxSpeed,
    turnSpeed: settings.turnSpeed / 10,
    drag: settings.drag / 100,
    popForce: settings.popForce / 10,
  };
}

function sanitizePhysicsSettings(value: unknown): PhysicsSettings {
  const raw = (value && typeof value === 'object') ? value as Partial<Record<PhysicsSettingKey, unknown>> : {};
  const next = { ...DEFAULT_PHYSICS_SETTINGS };

  for (const control of PHYSICS_SETTING_CONTROLS) {
    const candidate = raw[control.key];
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
      continue;
    }

    const wholeNumber = Math.round(candidate);
    next[control.key] = Math.max(control.min, Math.min(control.max, wholeNumber));
  }

  return next;
}

export function getStoredPhysicsSettings(): PhysicsSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_PHYSICS_SETTINGS };
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return { ...DEFAULT_PHYSICS_SETTINGS };
  }

  try {
    return sanitizePhysicsSettings(JSON.parse(rawValue));
  } catch {
    return { ...DEFAULT_PHYSICS_SETTINGS };
  }
}

export function savePhysicsSettings(settings: PhysicsSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizePhysicsSettings(settings)));
}
