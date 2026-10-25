const svg = (paths, size = 20) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const PATHS = {
  cabbage:
    '<path d="M12 21a8 8 0 0 1-8-8c0-3.6 2.4-6.6 5.6-7.6"/><path d="M12 21a8 8 0 0 0 8-8c0-3.6-2.4-6.6-5.6-7.6"/><path d="M12 21c-2.4-2.6-3.4-6-2.4-10.2C10.2 8 11 6.4 12 5c1 1.4 1.8 3 2.4 5.8 1 4.2 0 7.6-2.4 10.2z"/><path d="M12 5V3"/>',
  treasure:
    '<path d="M4 11a8 5 0 0 1 16 0"/><rect x="3" y="11" width="18" height="9" rx="1.5"/><path d="M3 14.5h18"/><path d="M10.5 13h3v3.5h-3z"/>',
  clue: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/><path d="M8 9a3 3 0 0 1 3-2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  tap: '<path d="M19.5 13A7.5 7.5 0 1 1 17 6.5"/><path d="M19.5 3.5V8H15"/>',
  untap: '<path d="M4.5 13A7.5 7.5 0 1 0 7 6.5"/><path d="M4.5 3.5V8H9"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  reset: '<path d="M4 7h16"/><path d="M6 7l1 13h10l1-13"/><path d="M9.5 7V4h5v3"/><path d="M10 11v5M14 11v5"/>',
  gear:
    '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  awake: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  sleep: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><path d="M4 4l16 16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a6.5 6.5 0 0 0 10 10z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.5"/><path d="M12 16.8h.01"/>',
  apps: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
};

export const icon = (name, size) => svg(PATHS[name], size);
