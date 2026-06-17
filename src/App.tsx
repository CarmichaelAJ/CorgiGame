import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import { createCorgiGame } from './game/createCorgiGame';

type RunnerStatus = 'ready' | 'running' | 'gameover';

type RunnerState = {
  score: number;
  best: number;
  status: RunnerStatus;
};

const initialState: RunnerState = {
  score: 0,
  best: Number(localStorage.getItem('corgi-best-score') ?? 0),
  status: 'ready',
};

const ENCOURAGING_MESSAGES = [
  'That was an adorable run.',
  'Samantha, you crushed it.',
  'The corgi is very proud.',
  'Another excellent sprint.',
  'Tiny legs, huge effort.',
  'Best dog mom energy.',
];

function encouragementFor(score: number, best: number) {
  return ENCOURAGING_MESSAGES[(score + best) % ENCOURAGING_MESSAGES.length];
}

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [runner, setRunner] = useState<RunnerState>(initialState);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) {
      return;
    }

    gameRef.current = createCorgiGame(hostRef.current);

    const onRunnerState = (event: Event) => {
      const detail = (event as CustomEvent<RunnerState>).detail;
      setRunner(detail);
    };

    window.addEventListener('corgi:state', onRunnerState);

    return () => {
      window.removeEventListener('corgi:state', onRunnerState);
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  const sendAction = (action: string) => {
    window.dispatchEvent(new CustomEvent('corgi:action', { detail: action }));
  };

  const showPanel = runner.status === 'ready' || runner.status === 'gameover';

  return (
    <main className="game-shell">
      <div ref={hostRef} className="game-stage" aria-label="Corgi runner game" />

      <div className="hud" aria-live="polite">
        <div className="score-stack">
          <span>Score</span>
          <strong>{runner.score.toString().padStart(3, '0')}</strong>
        </div>
        <div className="score-stack">
          <span>Best</span>
          <strong>{runner.best.toString().padStart(3, '0')}</strong>
        </div>
      </div>

      {showPanel && (
        <section className="start-panel">
          <img className="panel-corgi" src="./assets/sprites/corgi-happy.png" alt="" aria-hidden="true" />
          <h1>{runner.status === 'gameover' ? 'Great Job Samantha' : 'Corgi Game'}</h1>
          <p>{runner.status === 'gameover' ? encouragementFor(runner.score, runner.best) : 'Tap to jump. Catch the hat.'}</p>
          <button type="button" className="play-button" onClick={() => sendAction('start')} aria-label="Start run">
            <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>{runner.status === 'gameover' ? 'Run again' : 'Start'}</span>
          </button>
        </section>
      )}
    </main>
  );
}
