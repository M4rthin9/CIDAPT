<script lang="ts">
  import { session } from '$lib/auth.svelte';
  import { api, ApiRequestError } from '$lib/api';
  import { lang, t } from '$lib/i18n.svelte';

  interface Summary {
    orders: number;
    enquiries: number;
    products: number;
  }

  let counts = $state<Summary | null>(null);
  let error = $state('');
  let loading = $state(true);

  async function load() {
    error = '';
    loading = true;
    try {
      counts = await api<Summary>('/admin/summary');
    } catch (err) {
      error =
        err instanceof ApiRequestError
          ? lang.pick(err.message_th, err.message_en)
          : t('โหลดข้อมูลสรุปไม่สำเร็จ', 'Could not load summary');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });

  const roleLabel = $derived(
    (
      {
        superadmin: t('ผู้ดูแลระบบสูงสุด', 'Superadmin'),
        admin: t('ผู้ดูแลระบบ', 'Admin'),
        officer: t('เจ้าหน้าที่', 'Officer'),
      } as Record<string, string>
    )[session.user?.role ?? ''] ?? '',
  );

  const cards = $derived([
    { n: counts?.orders, th: 'คำสั่งซื้อที่ต้องดำเนินการ', en: 'Orders in progress' },
    { n: counts?.enquiries, th: 'ใบสอบถามที่ยังไม่ปิด', en: 'Open enquiries' },
    { n: counts?.products, th: 'สินค้าที่เผยแพร่', en: 'Published products' },
  ]);
</script>

<div class="screen">
  <div class="screen-head">
    <div>
      <h1>
        {t(
          `สวัสดี คุณ${session.user?.displayName ?? ''}`,
          `Welcome, ${session.user?.displayName ?? ''}`,
        )}
      </h1>
      <p>{roleLabel}</p>
    </div>
  </div>

  {#if error}<div class="banner banner-error" role="alert">{error}</div>{/if}

  <div class="cards">
    {#each cards as card (card.en)}
      <div class="card">
        <span class="num">{loading ? '—' : (card.n ?? '—')}</span>
        <span class="lbl">{lang.pick(card.th, card.en)}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-md);
  }
  .card {
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .num {
    font-family: var(--font-mono);
    font-size: 2rem;
    font-weight: 600;
  }
  .lbl {
    color: var(--slate);
    font-size: 0.9375rem;
  }
</style>
