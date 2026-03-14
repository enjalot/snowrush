interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
}

export function PauseMenu({ onResume, onRestart }: PauseMenuProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        color: '#fff',
      }}
    >
      <h2
        style={{
          fontSize: '48px',
          fontWeight: 'bold',
          margin: 0,
          textShadow: '0 4px 8px rgba(0,0,0,0.5)',
        }}
      >
        PAUSED
      </h2>
      <div style={{ marginTop: '32px', display: 'flex', gap: '16px' }}>
        <button
          onClick={onResume}
          style={{
            padding: '12px 36px',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#1a1a2e',
            background: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          RESUME
        </button>
        <button
          onClick={onRestart}
          style={{
            padding: '12px 36px',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#fff',
            background: 'rgba(255,255,255,0.2)',
            border: '2px solid rgba(255,255,255,0.4)',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          RESTART
        </button>
      </div>
      <p style={{ fontSize: '14px', opacity: 0.5, marginTop: '24px' }}>
        Press ESC to resume
      </p>
    </div>
  );
}
