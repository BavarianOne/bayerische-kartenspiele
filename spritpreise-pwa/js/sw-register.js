if (!('serviceWorker' in navigator)) {
  console.warn('Service Worker nicht unterstützt');
} else {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/spritpreise-pwa/sw.js', { scope: '/' });
      console.log('Service Worker registriert:', reg.scope);

      // Lausche auf Messages vom SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'FUEL_REFRESH') {
          window.dispatchEvent(new Event('focus'));
        }
      });
    } catch (err) {
      console.warn('SW Registrierung fehlgeschlagen:', err);
    }
  });
}