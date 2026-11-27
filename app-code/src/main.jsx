import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { SesionProvider } from './sesion';
import { MarcaProvider } from './marca';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/app">
      <MarcaProvider><SesionProvider><App /></SesionProvider></MarcaProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
