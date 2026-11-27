import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './i18n';
import { MarcaProvider } from './marca/Marca';
import App from './App';
import { SesionProvider } from './auth/Sesion';
import { AvisosProvider, ConfirmarProvider } from './ui';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AvisosProvider>
        <ConfirmarProvider>
          <SesionProvider>
            <MarcaProvider>
              <App />
            </MarcaProvider>
          </SesionProvider>
        </ConfirmarProvider>
      </AvisosProvider>
    </BrowserRouter>
  </StrictMode>,
);
