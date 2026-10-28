import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import bootstrapLtr from 'bootstrap/dist/css/bootstrap.min.css?url';
import bootstrapRtl from 'bootstrap/dist/css/bootstrap.rtl.min.css?url';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'react-toastify/dist/ReactToastify.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/noto-sans-arabic/arabic-400.css';
import '@fontsource/noto-sans-arabic/arabic-600.css';
import '@fontsource/noto-sans-arabic/arabic-700.css';
import './index.css';
import App from './App.jsx';
import { applyDocumentLanguage } from './i18n';

// Sets <html lang dir> and loads the matching Bootstrap stylesheet (LTR or RTL) before the first render.
applyDocumentLanguage(bootstrapLtr, bootstrapRtl).then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
