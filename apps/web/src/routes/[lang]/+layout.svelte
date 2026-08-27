<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  const nav = $derived(
    data.lang === 'th'
      ? [
          { href: '/th/fiberglass', label: 'ไฟเบอร์กลาส' },
          { href: '/th/needlework', label: 'เย็บปักถักร้อย' },
          { href: '/th/florals', label: 'ดอกไม้ประดิษฐ์' },
        ]
      : [
          { href: '/en/fiberglass', label: 'Fiberglass' },
          { href: '/en/needlework', label: 'Needlework' },
          { href: '/en/florals', label: 'Artificial Flowers' },
        ],
  );

  const otherLang = data.lang === 'th' ? 'en' : 'th';
  const otherLabel = data.lang === 'th' ? 'EN' : 'TH';

  function switchLang() {
    document.cookie = `lang=${otherLang};path=/;max-age=31536000`;
    const currentPath = window.location.pathname;
    const newPath = currentPath.replace(`/${data.lang}`, `/${otherLang}`);
    window.location.href = newPath;
  }
</script>

<div class="app">
  <header class="nav">
    <div class="nav-inner container">
      <a href="/{data.lang}" class="nav-logo">CIDA Craft</a>

      <nav class="nav-links" aria-label="Main navigation">
        {#each nav as link}
          <a href={link.href} class="nav-link">{link.label}</a>
        {/each}
      </nav>

      <div class="nav-actions">
        <a
          href="/{data.lang}/cart"
          class="nav-cart"
          aria-label={data.lang === 'th' ? 'ตะกร้า' : 'Cart'}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
        </a>

        <button class="nav-lang" onclick={switchLang} aria-label="Switch language">
          {otherLabel}
        </button>
      </div>
    </div>
  </header>

  <main>
    {@render children()}
  </main>

  <footer class="footer">
    <div class="container">
      <p class="footer-text">
        {data.lang === 'th'
          ? 'ฝ่ายฝึกวิชาชีพผู้ต้องขัง ทัณฑสถานบำบัดพิเศษกลาง'
          : 'Vocational Training Division, Special Central Correctional Institution'}
      </p>
      <p class="footer-copy">&copy; 2026 CIDA Craft</p>
    </div>
  </footer>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  main {
    flex: 1;
  }

  /* Navigation */
  .nav {
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    background-color: rgba(255, 255, 255, 0.85);
    border-bottom: 1px solid var(--line);
    height: var(--nav-height);
  }

  .nav-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 100%;
  }

  .nav-logo {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--ink);
    text-decoration: none;
    letter-spacing: -0.025em;
  }

  .nav-links {
    display: flex;
    gap: var(--space-xl);
  }

  .nav-link {
    color: var(--ink);
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
    transition: var(--transition-colors);
  }

  .nav-link:hover {
    color: var(--marigold);
    text-decoration: none;
  }

  .nav-actions {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .nav-cart {
    color: var(--ink);
    display: flex;
    align-items: center;
  }

  .nav-cart:hover {
    color: var(--marigold);
  }

  .nav-lang {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--slate);
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--line);
    border-radius: 4px;
    transition: var(--transition-colors);
  }

  .nav-lang:hover {
    color: var(--ink);
    border-color: var(--ink);
  }

  /* Footer */
  .footer {
    padding: var(--space-3xl) 0;
    border-top: 1px solid var(--line);
    background-color: var(--mist);
    text-align: center;
  }

  .footer-text {
    color: var(--slate);
    font-size: 0.875rem;
    margin-bottom: var(--space-sm);
  }

  .footer-copy {
    color: var(--slate);
    font-size: 0.75rem;
  }

  @media (max-width: 640px) {
    .nav-links {
      display: none;
    }
  }
</style>
