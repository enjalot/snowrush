import { useRef, useEffect, useState, useCallback } from 'react';
import { Game } from '../game/Game';
import { HUD } from './HUD';
import { MainMenu } from './MainMenu';
import { GameOverScreen } from './GameOverScreen';
import { PauseMenu } from './PauseMenu';
import type { GameUIState, GameStateType } from '../game/types';
import type { PhysicsSettingKey, PhysicsSettings } from '../game/physicsSettings';
import {
  DEFAULT_PHYSICS_SETTINGS,
  getStoredPhysicsSettings,
  savePhysicsSettings,
} from '../game/physicsSettings';
import {
  getDefaultLeaderboardName,
  generateLeaderboardName,
  getLeaderboard,
  saveLeaderboardEntry,
  type LeaderboardEntry,
} from './leaderboard';

function getViewportFlags() {
  if (typeof window === 'undefined') {
    return { isTouchDevice: false, isCompactLayout: false };
  }

  return {
    isTouchDevice: window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0,
    isCompactLayout: window.matchMedia('(max-width: 820px)').matches,
  };
}

export function GameContainer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const previousGameStateRef = useRef<GameStateType>('MENU');
  const [uiState, setUIState] = useState<GameUIState>({
    gameState: 'MENU',
    speed: 0,
    distance: 0,
    score: 0,
    trickName: null,
    health: 3,
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => getLeaderboard());
  const [draftName, setDraftName] = useState(() => getDefaultLeaderboardName());
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [physicsSettings, setPhysicsSettings] = useState<PhysicsSettings>(() => getStoredPhysicsSettings());
  const [{ isTouchDevice, isCompactLayout }, setViewportFlags] = useState(() => getViewportFlags());

  useEffect(() => {
    if (!canvasRef.current) return;

    const game = new Game(canvasRef.current, physicsSettings);
    gameRef.current = game;

    game.setUIStateCallback((state) => {
      setUIState(state);
    });

    return () => {
      game.dispose();
    };
  }, []);

  useEffect(() => {
    const updateViewportFlags = () => {
      setViewportFlags(getViewportFlags());
    };

    updateViewportFlags();
    window.addEventListener('resize', updateViewportFlags);
    return () => {
      window.removeEventListener('resize', updateViewportFlags);
    };
  }, []);

  useEffect(() => {
    const previousGameState = previousGameStateRef.current;

    if (uiState.gameState === 'PAUSED' && previousGameState !== 'PAUSED') {
      setLeaderboard(getLeaderboard());
    }

    if (uiState.gameState === 'GAME_OVER' && previousGameState !== 'GAME_OVER') {
      setDraftName(getDefaultLeaderboardName());
      setSavedEntryId(null);
      setLeaderboard(getLeaderboard());
    }

    previousGameStateRef.current = uiState.gameState;
  }, [uiState.gameState]);

  const handleStart = useCallback(() => {
    gameRef.current?.start();
  }, []);

  const handleRestart = useCallback(() => {
    gameRef.current?.restart();
  }, []);

  const handleResume = useCallback(() => {
    gameRef.current?.resume();
  }, []);

  const handlePause = useCallback(() => {
    gameRef.current?.pause();
  }, []);

  const handlePhysicsSettingChange = useCallback((key: PhysicsSettingKey, value: number) => {
    setPhysicsSettings((current) => {
      const next = {
        ...current,
        [key]: value,
      };
      savePhysicsSettings(next);
      gameRef.current?.setPhysicsSettings(next);
      return next;
    });
  }, []);

  const handlePhysicsSettingsReset = useCallback(() => {
    const next = { ...DEFAULT_PHYSICS_SETTINGS };
    setPhysicsSettings(next);
    savePhysicsSettings(next);
    gameRef.current?.setPhysicsSettings(next);
  }, []);

  const handleNameChange = useCallback((value: string) => {
    setDraftName(value);
  }, []);

  const handleNameRandomize = useCallback(() => {
    setDraftName(generateLeaderboardName());
  }, []);

  const handleLeaderboardSubmit = useCallback(() => {
    if (savedEntryId) {
      return;
    }

    const trimmedName = draftName.trim();
    const nextName = trimmedName || generateLeaderboardName();
    const { entry, leaderboard: nextLeaderboard } = saveLeaderboardEntry({
      name: nextName,
      score: uiState.score,
      distance: uiState.distance,
    });

    setDraftName(nextName);
    setLeaderboard(nextLeaderboard);
    setSavedEntryId(entry.id);
  }, [draftName, savedEntryId, uiState.distance, uiState.score]);

  const gameState: GameStateType = uiState.gameState;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          touchAction: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      />

      {gameState === 'MENU' && <MainMenu onStart={handleStart} isTouchDevice={isTouchDevice} />}
      {gameState === 'PLAYING' && (
        <HUD
          uiState={uiState}
          onPause={handlePause}
          isTouchDevice={isTouchDevice}
          isCompactLayout={isCompactLayout}
        />
      )}
      {gameState === 'PAUSED' && (
        <PauseMenu
          score={uiState.score}
          distance={uiState.distance}
          leaderboard={leaderboard}
          isTouchDevice={isTouchDevice}
          physicsSettings={physicsSettings}
          onPhysicsSettingChange={handlePhysicsSettingChange}
          onPhysicsSettingsReset={handlePhysicsSettingsReset}
          onResume={handleResume}
          onRestart={handleRestart}
        />
      )}
      {gameState === 'GAME_OVER' && (
        <GameOverScreen
          score={uiState.score}
          distance={uiState.distance}
          leaderboard={leaderboard}
          draftName={draftName}
          savedEntryId={savedEntryId}
          onDraftNameChange={handleNameChange}
          onRandomizeName={handleNameRandomize}
          onSubmitScore={handleLeaderboardSubmit}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}
