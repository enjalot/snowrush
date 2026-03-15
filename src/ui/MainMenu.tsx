interface MainMenuProps {
  onStart: () => void;
  isTouchDevice: boolean;
}

const cardStyle = {
  width: 'min(92vw, 560px)',
  maxHeight: 'calc(100dvh - 32px)',
  overflowY: 'auto' as const,
  padding: 'clamp(24px, 4vw, 36px)',
  borderRadius: '24px',
  background: 'linear-gradient(180deg, rgba(16, 23, 42, 0.94) 0%, rgba(22, 33, 62, 0.88) 100%)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
  textAlign: 'center' as const,
};

export function MainMenu({ onStart, isTouchDevice }: MainMenuProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.4)',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        color: '#fff',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
      }}
    >
      <div style={cardStyle}>
        <h1
          style={{
            fontSize: 'clamp(42px, 10vw, 64px)',
            fontWeight: 'bold',
            margin: 0,
            textShadow: '0 4px 8px rgba(0,0,0,0.5)',
            letterSpacing: '0.12em',
          }}
        >
          SNOW RUSH
        </h1>
        <p style={{ fontSize: 'clamp(16px, 4vw, 18px)', opacity: 0.8, marginTop: '10px' }}>
          Dodge. Jump. Ride.
        </p>
        <button
          onClick={onStart}
          style={{
            width: '100%',
            marginTop: '32px',
            padding: '16px 24px',
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#1a1a2e',
            background: '#fff',
            border: 'none',
            borderRadius: '14px',
            cursor: 'pointer',
          }}
        >
          START
        </button>

        <div
          style={{
            marginTop: '24px',
            display: 'grid',
            gap: '12px',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '16px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              fontSize: '14px',
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            {isTouchDevice
              ? 'Touch: hold to pump, release to pop, drag left and right to steer, pull up for speed and frontflips, pull down for braking and backflips.'
              : 'Keyboard: A and D steer, W and S control front and back flips, and hold then release Space to pump and pop.'}
          </div>
          {!isTouchDevice && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '16px',
                background: 'rgba(125,211,252,0.08)',
                border: '1px solid rgba(125,211,252,0.16)',
                fontSize: '13px',
                color: 'rgba(255,255,255,0.72)',
              }}
            >
              Phone-friendly touch controls are enabled automatically on touch devices.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
