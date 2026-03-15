import { uniqueNamesGenerator } from 'unique-names-generator';

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  distance: number;
  createdAt: string;
}

const LEADERBOARD_STORAGE_KEY = 'snowrush.leaderboard';
const PLAYER_NAME_STORAGE_KEY = 'snowrush.playerName';
const DISPLAY_ENTRY_LIMIT = 10;
const STORAGE_ENTRY_LIMIT = 50;

const nameDictionaries = [
  [
    'Powder',
    'Shredding',
    'Lucky',
    'Wild',
    'Turbo',
    'Frosty',
    'Glacial',
    'Stormy',
    'Airborne',
    'Neon',
  ],
  [
    'Yeti',
    'Comet',
    'Otter',
    'Rocket',
    'Raven',
    'Moose',
    'Mammoth',
    'Puma',
    'Viper',
    'Lynx',
  ],
  [
    'Rider',
    'Drifter',
    'Whisper',
    'Rocket',
    'Legend',
    'Bandit',
    'Blizzard',
    'Dash',
    'Carver',
    'Surge',
  ],
];

function sortLeaderboard(entries: LeaderboardEntry[]) {
  return [...entries].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (right.distance !== left.distance) {
      return right.distance - left.distance;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.score === 'number' &&
    typeof entry.distance === 'number' &&
    typeof entry.createdAt === 'string'
  );
}

function readStoredEntries() {
  if (typeof window === 'undefined') {
    return [];
  }

  const rawValue = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);
  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return sortLeaderboard(parsedValue.filter(isLeaderboardEntry));
  } catch {
    return [];
  }
}

function writeStoredEntries(entries: LeaderboardEntry[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    LEADERBOARD_STORAGE_KEY,
    JSON.stringify(sortLeaderboard(entries).slice(0, STORAGE_ENTRY_LIMIT))
  );
}

function readStoredPlayerName() {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  const trimmedValue = rawValue.trim();
  return trimmedValue || null;
}

function writeStoredPlayerName(name: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
}

export function getLeaderboard() {
  return readStoredEntries().slice(0, DISPLAY_ENTRY_LIMIT);
}

export function getDefaultLeaderboardName() {
  return readStoredPlayerName() ?? generateLeaderboardName();
}

export function saveLeaderboardEntry(entry: Omit<LeaderboardEntry, 'id' | 'createdAt'>) {
  const nextEntry: LeaderboardEntry = {
    ...entry,
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
  };

  const nextEntries = [...readStoredEntries(), nextEntry];
  writeStoredEntries(nextEntries);
  writeStoredPlayerName(nextEntry.name);

  return {
    entry: nextEntry,
    leaderboard: getLeaderboard(),
  };
}

export function generateLeaderboardName() {
  return uniqueNamesGenerator({
    dictionaries: nameDictionaries,
    separator: ' ',
    style: 'capital',
  });
}
