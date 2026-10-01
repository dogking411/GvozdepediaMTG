// Репозиторий, куда редактор сохраняет изменения (owner/repo).
// На GitHub Pages подставляется автоматически при сборке (см. .github/workflows/deploy.yml).
function detectRepo() {
  if (import.meta.env.VITE_GITHUB_REPO) return import.meta.env.VITE_GITHUB_REPO;
  const m = location.hostname.match(/^([^.]+)\.github\.io$/);
  const repo = location.pathname.split('/').filter(Boolean)[0];
  return m && repo ? `${m[1]}/${repo}` : '';
}

export const DEFAULT_REPO = detectRepo();
export const DECKS_DIR = 'content/decks';
