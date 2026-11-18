let panel: HTMLDivElement | undefined;

export function reportGameError(message: string) {
  if (!panel) {
    panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:18px;padding:28px;background:#241318;color:#fff1ce;font:600 18px/1.5 system-ui,sans-serif;text-align:center;white-space:pre-wrap;overflow-wrap:anywhere';
    document.body.appendChild(panel);
  }
  panel.textContent = `WILD MEAT TYCOON\n\n${message}`;
}

export function installGameErrorReporter() {
  window.addEventListener('error', event => reportGameError(`Erreur JavaScript : ${event.message || 'erreur inconnue'}`));
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    reportGameError(`Erreur de démarrage : ${reason}`);
  });
}
