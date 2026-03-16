import { useState } from 'react';
import type { PhysicsSettingKey, PhysicsSettings } from '../game/physicsSettings';
import { PHYSICS_SETTING_CONTROLS } from '../game/physicsSettings';
import type { NpcSettingKey, NpcSettings } from '../game/npcSettings';
import { NPC_SETTING_CONTROLS } from '../game/npcSettings';
import { NPC_APPEARANCES } from '../game/npcPalette';
import type { LeaderboardEntry } from './leaderboard';

interface PauseMenuProps {
  score: number;
  distance: number;
  leaderboard: LeaderboardEntry[];
  isTouchDevice: boolean;
  physicsSettings: PhysicsSettings;
  npcSettings: NpcSettings;
  onPhysicsSettingChange: (key: PhysicsSettingKey, value: number) => void;
  onPhysicsSettingsReset: () => void;
  onNpcSettingChange: (key: NpcSettingKey, value: number) => void;
  onNpcSettingsReset: () => void;
  onResume: () => void;
  onRestart: () => void;
}

const panelStyle = {
  width: 'min(94vw, 980px)',
  background: 'linear-gradient(180deg, rgba(16, 23, 42, 0.94) 0%, rgba(22, 33, 62, 0.88) 100%)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '24px',
  boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
  padding: '32px',
};

const cardStyle = {
  background: 'rgba(7, 12, 24, 0.55)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '18px',
};

export function PauseMenu({
  score,
  distance,
  leaderboard,
  isTouchDevice,
  physicsSettings,
  npcSettings,
  onPhysicsSettingChange,
  onPhysicsSettingsReset,
  onNpcSettingChange,
  onNpcSettingsReset,
  onResume,
  onRestart,
}: PauseMenuProps) {
  const [activeSettingsTab, setActiveSettingsTab] = useState<'physics' | 'npc'>('physics');

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
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
      }}
    >
      <div style={{ ...panelStyle, maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
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
              PAUSED
            </h2>

            <div style={{ marginTop: '24px', fontSize: '20px' }}>
              <div>Current score: <strong>{score}</strong></div>
              <div style={{ marginTop: '8px' }}>Current distance: <strong>{Math.floor(distance)}m</strong></div>
            </div>

            <div style={{ marginTop: '14px', fontSize: '14px', color: 'rgba(255,255,255,0.65)' }}>
              This run is only saved to the leaderboard after the race ends.
            </div>

            <div style={{ marginTop: '32px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={onResume}
                style={{
                  padding: '12px 36px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#1a1a2e',
                  background: '#fff',
                  border: 'none',
                  borderRadius: '12px',
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
                  background: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.24)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                }}
              >
                RESTART
              </button>
            </div>

            <p style={{ fontSize: '14px', opacity: 0.5, marginTop: '24px' }}>
              {isTouchDevice ? 'Tap Resume to drop back in.' : 'Press ESC to resume'}
            </p>
          </div>

          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ ...cardStyle, padding: '18px 20px' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setActiveSettingsTab('physics')}
                  style={{
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#fff',
                    background: activeSettingsTab === 'physics' ? 'rgba(125,211,252,0.22)' : 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: '999px',
                    cursor: 'pointer',
                  }}
                >
                  Ride Tuning
                </button>
                <button
                  onClick={() => setActiveSettingsTab('npc')}
                  style={{
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#fff',
                    background: activeSettingsTab === 'npc' ? 'rgba(125,211,252,0.22)' : 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: '999px',
                    cursor: 'pointer',
                  }}
                >
                  NPC Rivals
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'start',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '14px',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.75)',
                    }}
                  >
                    {activeSettingsTab === 'physics' ? 'Ride Tuning' : 'NPC Rivals'}
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                    {activeSettingsTab === 'physics'
                      ? 'Whole-number sliders, saved locally, and applied immediately.'
                      : 'Tune the rival pack live. Their strategy already considers obstacles, crowding, and future threat inputs.'}
                  </div>
                </div>

                <button
                  onClick={activeSettingsTab === 'physics' ? onPhysicsSettingsReset : onNpcSettingsReset}
                  style={{
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#fff',
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                  }}
                >
                  Reset
                </button>
              </div>

              {activeSettingsTab === 'physics' ? (
                <div style={{ marginTop: '18px', display: 'grid', gap: '14px' }}>
                  {PHYSICS_SETTING_CONTROLS.map((control) => {
                    const value = physicsSettings[control.key];
                    const valueLabel = control.unit ? `${value}${control.unit}` : `${value}`;

                    return (
                      <label key={control.key} style={{ display: 'grid', gap: '8px' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            gap: '12px',
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>{control.label}</span>
                          <span style={{ color: '#7dd3fc', fontVariantNumeric: 'tabular-nums' }}>{valueLabel}</span>
                        </div>
                        <input
                          type="range"
                          min={control.min}
                          max={control.max}
                          step={1}
                          value={value}
                          onChange={(event) => onPhysicsSettingChange(control.key, Number(event.target.value))}
                        />
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.58)' }}>{control.hint}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div style={{ marginTop: '18px', display: 'grid', gap: '14px' }}>
                  {NPC_SETTING_CONTROLS.map((control) => {
                    const value = npcSettings[control.key];

                    return (
                      <label key={control.key} style={{ display: 'grid', gap: '8px' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            gap: '12px',
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>{control.label}</span>
                          <span style={{ color: '#7dd3fc', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                        </div>
                        <input
                          type="range"
                          min={control.min}
                          max={control.max}
                          step={1}
                          value={value}
                          onChange={(event) => onNpcSettingChange(control.key, Number(event.target.value))}
                        />
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.58)' }}>{control.hint}</span>
                      </label>
                    );
                  })}

                  <div
                    style={{
                      marginTop: '2px',
                      padding: '14px',
                      borderRadius: '14px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div style={{ fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
                      Rival Palette
                    </div>
                    <div style={{ marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {NPC_APPEARANCES.slice(0, Math.max(2, npcSettings.count)).map((appearance, index) => (
                        <div
                          key={`${appearance.labelColor}-${index}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 10px',
                            borderRadius: '999px',
                            background: 'rgba(255,255,255,0.05)',
                          }}
                        >
                          <span
                            style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '999px',
                              background: appearance.labelColor,
                              boxShadow: `0 0 0 3px rgba(255,255,255,0.08), 0 0 14px ${appearance.labelColor}`,
                            }}
                          />
                          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>Rival {index + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
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
              <div style={{ ...cardStyle, marginTop: '14px', overflow: 'hidden' }}>
                {leaderboard.length === 0 ? (
                  <div style={{ padding: '18px 20px', color: 'rgba(255,255,255,0.7)' }}>
                    No runs saved yet. Claim the mountain.
                  </div>
                ) : (
                  leaderboard.map((entry, index) => (
                    <div
                      key={entry.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '48px 1fr auto',
                        gap: '12px',
                        alignItems: 'center',
                        padding: '14px 18px',
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
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
