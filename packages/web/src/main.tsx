import { createRoot } from 'react-dom/client';
import { Shell } from './app/shell.tsx';
import './app/app.css';

createRoot(document.getElementById('root')!).render(<Shell />);
