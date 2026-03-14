import { useRef, useEffect, useState, useCallback } from 'react';
import { Game } from '../game/Game';
import { HUD } from './HUD';
import { MainMenu } from './MainMenu';
import { GameOverScreen } from './GameOverScreen';
import { PauseMenu } from './PauseMenu';
import type { GameUIState, GameStateType } from '../game/types';

export function GameContainer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [uiState, setUIState] = useState<GameUIState>({
    gameState: 'MENU',
    speed: 0,
    distance: 0,
    score: 0,
    trickName: null,
    health: 3,
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    const game = new Game(canvasRef.current);
    gameRef.current = game;

    game.setUIStateCallback((state) => {
      setUIState(state);
    });

    return () => {
      game.dispose();
    };
  }, []);

  const handleStart = useCallback(() => {
    gameRef.current?.start();
  }, []);

  const handleRestart = useCallback(() => {
    gameRef.current?.restart();
  }, []);

  const handleResume = useCallback(() => {
    gameRef.current?.resume();
  }, []);

  const gameState: GameStateType = uiState.gameState;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />

      {gameState === 'MENU' && <MainMenu onStart={handleStart} />}
      {gameState === 'PLAYING' && <HUD uiState={uiState} />}
      {gameState === 'PAUSED' && (
        <PauseMenu onResume={handleResume} onRestart={handleRestart} />
      )}
      {gameState === 'GAME_OVER' && (
        <GameOverScreen score={uiState.score} distance={uiState.distance} onRestart={handleRestart} />
      )}
    </div>
  );
}
