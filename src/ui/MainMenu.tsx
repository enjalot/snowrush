interface MainMenuProps {
  onStart: () => void;
}

export function MainMenu({ onStart }: MainMenuProps) {
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
      }}
    >
      <h1
        style={{
          fontSize: '64px',
          fontWeight: 'bold',
          margin: 0,
          textShadow: '0 4px 8px rgba(0,0,0,0.5)',
          letterSpacing: '4px',
        }}
      >
        SNOW RUSH
      </h1>
      <p style={{ fontSize: '18px', opacity: 0.8, marginTop: '8px' }}>
        Dodge. Jump. Ride.
      </p>
      <button
        onClick={onStart}
        style={{
          marginTop: '40px',
          padding: '14px 48px',
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#1a1a2e',
          background: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'transform 0.1s',
        }}
        onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        START
      </button>
      <p style={{ fontSize: '14px', opacity: 0.5, marginTop: '24px' }}>
        WASD to steer &bull; SPACE to pump (hold &amp; release to pop)
      </p>
    </div>
  );
}
