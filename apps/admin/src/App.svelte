<script lang="ts">
  import { onMount } from 'svelte';
  import { session, type Role } from '$lib/auth.svelte';
  import { lang, t } from '$lib/i18n.svelte';
  import { currentRoute, navigate } from '$lib/router.svelte';
  import Login from './routes/login/Login.svelte';
  import Dashboard from './routes/dashboard/Dashboard.svelte';
  import Products from './routes/catalog/Products.svelte';
  import Orders from './routes/orders/Orders.svelte';
  import Inventory from './routes/inventory/Inventory.svelte';
  import Enquiries from './routes/enquiries/Enquiries.svelte';
  import Coupons from './routes/coupons/Coupons.svelte';
  import Content from './routes/content/Content.svelte';
  import Settings from './routes/settings/Settings.svelte';
  import Users from './routes/users/Users.svelte';
  import Audit from './routes/audit/Audit.svelte';
  import Reports from './routes/reports/Reports.svelte';
  import Payments from './routes/payments/Payments.svelte';
  import NotFound from './routes/NotFound.svelte';

  const route = $derived(currentRoute());
  const path = $derived(route.split('?')[0] ?? '/');

  interface NavItem {
    path: string;
    th: string;
    en: string;
    min: Role;
  }

  // `min` is the display floor only — each endpoint re-checks the role server-side.
  const nav: NavItem[] = [
    { path: '/dashboard', th: 'แดชบอร์ด', en: 'Dashboard', min: 'officer' },
    { path: '/reports', th: 'รายงาน', en: 'Reports', min: 'officer' },
    { path: '/orders', th: 'คำสั่งซื้อ', en: 'Orders', min: 'officer' },
    { path: '/inventory', th: 'คลังสินค้า', en: 'Inventory', min: 'officer' },
    { path: '/enquiries', th: 'ใบสอบถาม', en: 'Enquiries', min: 'officer' },
    { path: '/products', th: 'สินค้า', en: 'Products', min: 'admin' },
    { path: '/coupons', th: 'คูปอง', en: 'Coupons', min: 'admin' },
    { path: '/content', th: 'เนื้อหา', en: 'Content', min: 'admin' },
    { path: '/settings', th: 'ตั้งค่า', en: 'Settings', min: 'superadmin' },
    { path: '/users', th: 'ผู้ใช้', en: 'Users', min: 'superadmin' },
    { path: '/audit', th: 'บันทึกตรวจสอบ', en: 'Audit', min: 'superadmin' },
    { path: '/payments', th: 'การชำระเงิน', en: 'Payments', min: 'superadmin' },
  ];

  const visibleNav = $derived(nav.filter((n) => session.hasRole(n.min)));

  onMount(() => {
    // Always revalidate against /auth/me: the cached user is a paint-fast hint,
    // the cookie is what actually authorises.
    void session.refresh();
  });

  async function handleLogout() {
    await session.logout();
    navigate('/login');
  }
</script>

{#if !session.loaded}
  <div class="boot" role="status" aria-live="polite">
    <p>{t('กำลังโหลด...', 'Loading...')}</p>
  </div>
{:else if !session.isAuthed}
  <Login />
{:else}
  <div class="shell">
    <nav class="sidebar" aria-label={t('เมนูผู้ดูแล', 'Admin navigation')}>
      <div class="brand">
        <span class="brand-mark">CIDA</span>
        <span class="brand-sub">Craft Admin</span>
      </div>
      <ul class="nav-list">
        {#each visibleNav as item (item.path)}
          <li>
            <a
              href="#{item.path}"
              class:active={path === item.path || path.startsWith(`${item.path}/`)}
              aria-current={path === item.path ? 'page' : undefined}
            >
              {lang.pick(item.th, item.en)}
            </a>
          </li>
        {/each}
      </ul>
    </nav>

    <div class="main">
      <header class="topbar">
        <button class="btn" onclick={() => lang.toggle()}>
          {lang.value === 'th' ? 'EN' : 'TH'}
        </button>
        <span class="role-tag">{session.user?.displayName} · {session.user?.role}</span>
        <button class="btn" onclick={handleLogout}>{t('ออกจากระบบ', 'Logout')}</button>
      </header>

      <main class="content">
        {#if path === '/' || path.startsWith('/dashboard') || path.startsWith('/login')}
          <Dashboard />
        {:else if path.startsWith('/reports')}
          <Reports />
        {:else if path.startsWith('/orders')}
          <Orders />
        {:else if path.startsWith('/inventory')}
          <Inventory />
        {:else if path.startsWith('/enquiries')}
          <Enquiries />
        {:else if path.startsWith('/products')}
          <Products />
        {:else if path.startsWith('/coupons')}
          <Coupons />
        {:else if path.startsWith('/content')}
          <Content />
        {:else if path.startsWith('/settings')}
          <Settings />
        {:else if path.startsWith('/users')}
          <Users />
        {:else if path.startsWith('/audit')}
          <Audit />
        {:else if path.startsWith('/payments')}
          <Payments />
        {:else}
          <NotFound />
        {/if}
      </main>
    </div>
  </div>
{/if}
