import type { GameUIState } from '../game/types';

interface HUDProps {
  uiState: GameUIState;
  onPause: () => void;
  isTouchDevice: boolean;
  isCompactLayout: boolean;
}

const hudCardStyle = {
  padding: '12px 14px',
  borderRadius: '16px',
  background: 'rgba(8, 13, 26, 0.48)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(10px)',
};

export function HUD({ uiState, onPause, isTouchDevice, isCompactLayout }: HUDProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: 'max(14px, env(safe-area-inset-top))',
        paddingRight: 'max(14px, env(safe-area-inset-right))',
        paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(14px, env(safe-area-inset-left))',
        pointerEvents: 'none',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        color: '#fff',
        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isCompactLayout ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
          gap: '10px',
          alignItems: 'stretch',
          padding: isCompactLayout ? '8px 0 0' : '8px 56px 0 0',
        }}
      >
        <div style={hudCardStyle}>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>DISTANCE</div>
          <div style={{ fontSize: 'clamp(24px, 5vw, 28px)', fontWeight: 'bold' }}>
            {Math.floor(uiState.distance)}m
          </div>
        </div>

        <div style={{ ...hudCardStyle, textAlign: isCompactLayout ? 'left' : 'center' }}>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>SPEED</div>
          <div style={{ fontSize: 'clamp(24px, 5vw, 28px)', fontWeight: 'bold' }}>
            {Math.floor(uiState.speed * 3.6)} km/h
          </div>
        </div>

        <div style={{ ...hudCardStyle, textAlign: isCompactLayout ? 'left' : 'center' }}>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>SCORE</div>
          <div style={{ fontSize: 'clamp(24px, 5vw, 28px)', fontWeight: 'bold' }}>
            {uiState.score}
          </div>
        </div>

        <div style={{ ...hudCardStyle, textAlign: isCompactLayout ? 'left' : 'right' }}>
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

      <button
        onClick={onPause}
        style={{
          position: 'absolute',
          top: 'max(14px, env(safe-area-inset-top))',
          right: 'max(14px, env(safe-area-inset-right))',
          width: isCompactLayout ? '48px' : '56px',
          height: isCompactLayout ? '48px' : '56px',
          borderRadius: '999px',
          border: '1px solid rgba(255,255,255,0.18)',
          background: 'rgba(8, 13, 26, 0.58)',
          color: '#fff',
          fontSize: '15px',
          fontWeight: 700,
          pointerEvents: 'auto',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
        }}
      >
        II
      </button>

      {/* Trick name flash */}
      {uiState.trickName && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: uiState.trickName.includes('BAD') ? 'clamp(26px, 7vw, 32px)' : 'clamp(28px, 8vw, 36px)',
            fontWeight: 'bold',
            color: uiState.trickName.includes('BAD') ? '#ff4444' : '#ffdd44',
            textShadow: '0 2px 8px rgba(0,0,0,0.7)',
            whiteSpace: 'normal',
            textAlign: 'center',
            maxWidth: '82vw',
            animation: 'trickPop 0.3s ease-out',
          }}
        >
          {uiState.trickName}
        </div>
      )}

      {isTouchDevice && (
        <div
          style={{
            position: 'absolute',
            left: 'max(14px, env(safe-area-inset-left))',
            right: 'max(14px, env(safe-area-inset-right))',
            bottom: 'max(14px, env(safe-area-inset-bottom))',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              maxWidth: 'min(92vw, 420px)',
              padding: '12px 14px',
              borderRadius: '16px',
              background: 'rgba(8, 13, 26, 0.52)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(10px)',
              fontSize: '13px',
              lineHeight: 1.4,
              textAlign: 'center',
            }}
          >
            Hold to pump. Release to pop. Drag left and right to steer. Pull up for speed and frontflips, down for braking and backflips.
          </div>
        </div>
      )}
    </div>
  );
}
