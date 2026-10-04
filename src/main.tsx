import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { I18nProvider } from './i18n';
import { VoiceLibraryProvider } from './lib/voice-library';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/fraunces';
import './styles.css';

registerSW({ immediate: true });
void navigator.storage?.persist?.();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <VoiceLibraryProvider>
        <App />
      </VoiceLibraryProvider>
    </I18nProvider>
  </StrictMode>,
);
