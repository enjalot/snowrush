import type { GameUIState } from '../game/types';

interface HUDProps {
  uiState: GameUIState;
}

export function HUD({ uiState }: HUDProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '16px 24px',
        pointerEvents: 'none',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        color: '#fff',
        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
      }}
    >
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>DISTANCE</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
            {Math.floor(uiState.distance)}m
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>SPEED</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
            {Math.floor(uiState.speed * 3.6)} km/h
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>SCORE</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
            {uiState.score}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>HEALTH</div>
          <div style={{ fontSize: '24px' }}>
            {Array.from({ length: 3 }, (_, i) => (
              <span key={i} style={{ opacity: i < uiState.health ? 1 : 0.2 }}>
                {'\u2764'}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Trick name flash */}
      {uiState.trickName && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: uiState.trickName.includes('BAD') ? '32px' : '36px',
            fontWeight: 'bold',
            color: uiState.trickName.includes('BAD') ? '#ff4444' : '#ffdd44',
            textShadow: '0 2px 8px rgba(0,0,0,0.7)',
            whiteSpace: 'nowrap',
            animation: 'trickPop 0.3s ease-out',
          }}
        >
          {uiState.trickName}
        </div>
      )}
    </div>
  );
}
