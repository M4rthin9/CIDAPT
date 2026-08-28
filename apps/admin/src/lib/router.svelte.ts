let current = $state<string>(readHash());

function readHash(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h ? h : '/';
}

export function navigate(path: string) {
  window.location.hash = path;
}

export function currentRoute(): string {
  return current;
}

window.addEventListener('hashchange', () => {
  current = readHash();
});
