import React from 'react';
import ReactDOM from 'react-dom/client';
import AppWithTheme from './AppWithTheme';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <AppWithTheme />
  </React.StrictMode>
);