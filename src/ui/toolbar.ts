export function createToolbar(): HTMLElement {
  const nav = document.createElement('header');
  nav.className = 'navbar';
  nav.innerHTML = `<span class="navbar__title">img2pdf</span>`;
  return nav;
}
