import { useState } from 'react';
import type { GameUIState } from '../game/types';

const HUD_HINT_DISMISSED_KEY = 'snowrush.hudHintDismissed';

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
  const placementRail = uiState.racePlacements;
  const [showTouchHint, setShowTouchHint] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    return window.localStorage.getItem(HUD_HINT_DISMISSED_KEY) !== 'true';
  });

  const handleDismissTouchHint = () => {
    setShowTouchHint(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(HUD_HINT_DISMISSED_KEY, 'true');
    }
  };

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
          display: 'flex',
          alignItems: 'flex-start',
          gap: isCompactLayout ? '8px' : '12px',
          paddingTop: '8px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: isCompactLayout ? '6px' : '10px',
            flex: 1,
            minWidth: 0,
          }}
        >
          <div style={{ ...hudCardStyle, padding: isCompactLayout ? '8px 10px' : hudCardStyle.padding }}>
            <div style={{ fontSize: isCompactLayout ? '11px' : '14px', opacity: 0.8 }}>DISTANCE</div>
            <div style={{ fontSize: isCompactLayout ? '18px' : 'clamp(24px, 5vw, 28px)', fontWeight: 'bold' }}>
              {Math.floor(uiState.distance)}m
            </div>
          </div>

          <div
            style={{
              ...hudCardStyle,
              padding: isCompactLayout ? '8px 10px' : hudCardStyle.padding,
              textAlign: isCompactLayout ? 'left' : 'center',
            }}
          >
            <div style={{ fontSize: isCompactLayout ? '11px' : '14px', opacity: 0.8 }}>SPEED</div>
            <div style={{ fontSize: isCompactLayout ? '18px' : 'clamp(24px, 5vw, 28px)', fontWeight: 'bold' }}>
              {Math.floor(uiState.speed * 3.6)} km/h
            </div>
          </div>

          <div
            style={{
              ...hudCardStyle,
              padding: isCompactLayout ? '8px 10px' : hudCardStyle.padding,
              textAlign: isCompactLayout ? 'left' : 'center',
            }}
          >
            <div style={{ fontSize: isCompactLayout ? '11px' : '14px', opacity: 0.8 }}>SCORE</div>
            <div style={{ fontSize: isCompactLayout ? '18px' : 'clamp(24px, 5vw, 28px)', fontWeight: 'bold' }}>
              {uiState.score}
            </div>
          </div>

          <div
            style={{
              ...hudCardStyle,
              padding: isCompactLayout ? '8px 10px' : hudCardStyle.padding,
              textAlign: isCompactLayout ? 'left' : 'right',
            }}
          >
            <div style={{ fontSize: isCompactLayout ? '11px' : '14px', opacity: 0.8 }}>HEALTH</div>
            <div style={{ fontSize: isCompactLayout ? '18px' : '24px' }}>
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
            flexShrink: 0,
          }}
        >
          II
        </button>
      </div>

      {placementRail.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: isCompactLayout ? 'max(70px, calc(env(safe-area-inset-top) + 56px))' : 'max(84px, calc(env(safe-area-inset-top) + 70px))',
            right: 'max(14px, env(safe-area-inset-right))',
            width: isCompactLayout ? '64px' : '76px',
            maxHeight: isCompactLayout ? '46dvh' : '62dvh',
            overflowY: 'auto',
            padding: isCompactLayout ? '8px 6px' : '10px 8px',
            borderRadius: '18px',
            background: 'rgba(8, 13, 26, 0.58)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ fontSize: '10px', opacity: 0.72, letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>
            Pos
          </div>
          <div style={{ marginTop: '8px', display: 'grid', gap: '6px', justifyItems: 'center' }}>
            {placementRail.map((placement) => {
              const tokenLabel = placement.isPlayer ? 'YOU' : placement.name.replace('RIVAL ', '');
              return (
                <div
                  key={placement.id}
                  style={{
                    display: 'grid',
                    justifyItems: 'center',
                    gap: '3px',
                    width: '100%',
                    padding: isCompactLayout ? '5px 0' : '6px 0',
                    borderRadius: '12px',
                    background: placement.isPlayer ? 'rgba(125, 211, 252, 0.16)' : 'rgba(255,255,255,0.04)',
                    border: placement.isPlayer ? '1px solid rgba(125,211,252,0.28)' : '1px solid rgba(255,255,255,0.04)',
                    opacity: placement.eliminated ? 0.45 : 1,
                  }}
                >
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#7dd3fc', lineHeight: 1 }}>#{placement.place}</div>
                  <div
                    style={{
                      width: isCompactLayout ? '36px' : '42px',
                      height: isCompactLayout ? '36px' : '42px',
                      borderRadius: '999px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: placement.isPlayer ? 'rgba(125, 211, 252, 0.22)' : 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      fontSize: placement.isPlayer ? '9px' : '13px',
                      fontWeight: 800,
                      letterSpacing: placement.isPlayer ? '0.04em' : '0.02em',
                      lineHeight: 1,
                    }}
                  >
                    {tokenLabel}
                  </div>
                  <div style={{ fontSize: '9px', opacity: 0.62, lineHeight: 1 }}>
                    {placement.finished ? 'FIN' : placement.eliminated ? 'KO' : Math.round(placement.distance)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {isTouchDevice && showTouchHint && (
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
          <button
            type="button"
            onClick={handleDismissTouchHint}
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
              pointerEvents: 'auto',
              cursor: 'pointer',
              color: '#fff',
            }}
          >
            Hold to pump. Release to pop. Drag left and right to steer. Pull up for speed and frontflips, down for braking and backflips. While grinding a rail, keep dragging up or down to manual and left or right to spin. Tap to dismiss.
          </button>
        </div>
      )}
    </div>
  );
}
