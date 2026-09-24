import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import '@fontsource/alexandria/400.css';
import '@fontsource/alexandria/700.css';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/700.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
