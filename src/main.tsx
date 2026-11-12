import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/app.css';
import './styles/voice.css';
import { useGame } from './store/game';

// Development only: lets a script reach the game state, for example to look at the office at another time of day.
if (import.meta.env.DEV) (window as unknown as { __game?: typeof useGame }).__game = useGame;

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
