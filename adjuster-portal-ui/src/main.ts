import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
} else if ('serviceWorker' in navigator) {
  // Dev: unregister any service worker left over from a prior prod visit and purge its
  // caches. A stale SW will keep serving old bundle names and can force full page reloads
  // when the browser detects a hash mismatch against what the current ng serve emits.
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  if ('caches' in window) {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  }
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
