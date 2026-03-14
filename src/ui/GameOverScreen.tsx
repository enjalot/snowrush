interface GameOverScreenProps {
  score: number;
  distance: number;
  onRestart: () => void;
}

export function GameOverScreen({ score, distance, onRestart }: GameOverScreenProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
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
        WIPEOUT!
      </h2>
      <div style={{ marginTop: '24px', fontSize: '20px', textAlign: 'center' }}>
        <div>Distance: <strong>{Math.floor(distance)}m</strong></div>
        <div style={{ marginTop: '8px' }}>Score: <strong>{score}</strong></div>
      </div>
      <button
        onClick={onRestart}
        style={{
          marginTop: '32px',
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
        PLAY AGAIN
      </button>
    </div>
  );
}
