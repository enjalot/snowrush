import type { FormEvent } from 'react';
import type { LeaderboardEntry } from './leaderboard';

interface GameOverScreenProps {
  score: number;
  distance: number;
  leaderboard: LeaderboardEntry[];
  draftName: string;
  savedEntryId: string | null;
  onDraftNameChange: (value: string) => void;
  onRandomizeName: () => void;
  onSubmitScore: () => void;
  onRestart: () => void;
}

const overlayCardStyle = {
  width: 'min(92vw, 760px)',
  maxHeight: 'calc(100dvh - 32px)',
  overflowY: 'auto' as const,
  background: 'linear-gradient(180deg, rgba(16, 23, 42, 0.95) 0%, rgba(22, 33, 62, 0.9) 100%)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '24px',
  boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
  padding: '32px',
};

const secondaryButtonStyle = {
  padding: '12px 18px',
  fontSize: '16px',
  fontWeight: 700,
  color: '#fff',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: '12px',
  cursor: 'pointer',
};

export function GameOverScreen({
  score,
  distance,
  leaderboard,
  draftName,
  savedEntryId,
  onDraftNameChange,
  onRandomizeName,
  onSubmitScore,
  onRestart,
}: GameOverScreenProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmitScore();
  };

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
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
      }}
    >
      <div style={overlayCardStyle}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '28px',
            alignItems: 'start',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 'clamp(38px, 8vw, 48px)',
                fontWeight: 'bold',
                margin: 0,
                textShadow: '0 4px 8px rgba(0,0,0,0.5)',
              }}
            >
              WIPEOUT!
            </h2>
            <div style={{ marginTop: '24px', fontSize: '20px' }}>
              <div>Distance: <strong>{Math.floor(distance)}m</strong></div>
              <div style={{ marginTop: '8px' }}>Score: <strong>{score}</strong></div>
            </div>

            <form onSubmit={handleSubmit} style={{ marginTop: '28px' }}>
              <label
                htmlFor="leaderboard-name"
                style={{
                  display: 'block',
                  marginBottom: '10px',
                  fontSize: '14px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.75)',
                }}
              >
                Enter your rider name
              </label>
              <input
                id="leaderboard-name"
                type="text"
                maxLength={40}
                value={draftName}
                onChange={(event) => onDraftNameChange(event.target.value)}
                placeholder="Type a name or roll a random one"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '18px',
                  color: '#fff',
                  background: 'rgba(7, 12, 24, 0.85)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: '14px',
                  boxSizing: 'border-box',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginTop: '14px',
                }}
              >
                <button type="button" onClick={onRandomizeName} style={secondaryButtonStyle}>
                  Random Name
                </button>
                <button
                  type="submit"
                  disabled={savedEntryId !== null}
                  style={{
                    padding: '12px 18px',
                    fontSize: '16px',
                    fontWeight: 700,
                    color: savedEntryId ? 'rgba(255,255,255,0.65)' : '#1a1a2e',
                    background: savedEntryId ? 'rgba(255,255,255,0.12)' : '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: savedEntryId ? 'default' : 'pointer',
                  }}
                >
                  {savedEntryId ? 'Score Saved' : 'Save Score'}
                </button>
              </div>
            </form>

            <button
              onClick={onRestart}
              style={{
                marginTop: '24px',
                padding: '14px 32px',
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#1a1a2e',
                background: '#7dd3fc',
                border: 'none',
                borderRadius: '14px',
                cursor: 'pointer',
              }}
            >
              PLAY AGAIN
            </button>
          </div>

          <div>
            <div
              style={{
                fontSize: '14px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.75)',
              }}
            >
              Local Leaderboard
            </div>
            <div
              style={{
                marginTop: '14px',
                background: 'rgba(7, 12, 24, 0.55)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '18px',
                overflow: 'hidden',
              }}
            >
              {leaderboard.length === 0 ? (
                <div style={{ padding: '18px 20px', color: 'rgba(255,255,255,0.7)' }}>
                  No runs saved yet. Claim the mountain.
                </div>
              ) : (
                leaderboard.map((entry, index) => {
                  const isSavedEntry = entry.id === savedEntryId;

                  return (
                    <div
                      key={entry.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '48px 1fr auto',
                        gap: '12px',
                        alignItems: 'center',
                        padding: '14px 18px',
                        background: isSavedEntry ? 'rgba(125, 211, 252, 0.14)' : 'transparent',
                        borderTop: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#7dd3fc' }}>#{index + 1}</div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{entry.name}</div>
                        <div style={{ marginTop: '4px', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
                          {Math.floor(entry.distance)}m run
                        </div>
                      </div>
                      <div style={{ fontWeight: 700 }}>{entry.score}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
