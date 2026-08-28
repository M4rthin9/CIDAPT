<script lang="ts">
  import { api, ApiRequestError } from '$lib/api';
  import { lang, t, formatDate } from '$lib/i18n.svelte';
  import Screen from '$lib/ui/Screen.svelte';
  import Modal from '$lib/ui/Modal.svelte';

  interface Enquiry {
    id: string;
    productId: string;
    productNameTh: string;
    productNameEn: string;
    ribbonText: string;
    deliveryDate: number | null;
    deliveryTimeNote: string | null;
    venue: string;
    contactName: string;
    phone: string;
    email: string | null;
    lineId: string | null;
    message: string | null;
    status: string;
    createdAt: number;
  }

  const STATUSES = ['new', 'contacted', 'quoted', 'converted', 'closed'] as const;

  const STATUS_LABEL: Record<string, [string, string]> = {
    new: ['ใหม่', 'New'],
    contacted: ['ติดต่อแล้ว', 'Contacted'],
    quoted: ['เสนอราคาแล้ว', 'Quoted'],
    converted: ['ปิดการขาย', 'Converted'],
    closed: ['ปิดเรื่อง', 'Closed'],
  };

  const statusLabel = (s: string) => {
    const pair = STATUS_LABEL[s];
    return pair ? lang.pick(pair[0], pair[1]) : s;
  };

  let enquiries = $state<Enquiry[]>([]);
  let loading = $state(true);
  let error = $state('');
  let notice = $state('');
  let filterStatus = $state('');

  let selected = $state<Enquiry | null>(null);
  let nextStatus = $state('');
  let busy = $state(false);

  function describe(err: unknown, fallbackTh: string, fallbackEn: string): string {
    return err instanceof ApiRequestError
      ? lang.pick(err.message_th, err.message_en)
      : t(fallbackTh, fallbackEn);
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const qs = filterStatus ? `?status=${encodeURIComponent(filterStatus)}` : '';
      enquiries = await api<Enquiry[]>(`/admin/enquiries${qs}`);
    } catch (err) {
      error = describe(err, 'โหลดใบสอบถามไม่สำเร็จ', 'Could not load enquiries');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });

  function open(enquiry: Enquiry) {
    selected = enquiry;
    nextStatus = enquiry.status;
  }

  async function saveStatus() {
    if (!selected) return;
    busy = true;
    error = '';
    try {
      await api(`/admin/enquiries/${selected.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      notice = t('อัปเดตสถานะแล้ว', 'Status updated');
      selected = null;
      await load();
    } catch (err) {
      error = describe(err, 'อัปเดตสถานะไม่สำเร็จ', 'Could not update status');
    } finally {
      busy = false;
    }
  }
</script>

<Screen
  title={t('ใบสอบถาม', 'Enquiries')}
  subtitle={t(
    'สินค้าที่ต้องสอบถามราคา เช่น พวงหรีดและงานสั่งทำ',
    'Enquiry-only products such as wreaths and commissions',
  )}
  {loading}
  {error}
  {notice}
>
  <div class="toolbar">
    <label class="field inline">
      {t('สถานะ', 'Status')}
      <select bind:value={filterStatus}>
        <option value="">{t('ทั้งหมด', 'All')}</option>
        {#each STATUSES as s (s)}
          <option value={s}>{statusLabel(s)}</option>
        {/each}
      </select>
    </label>
  </div>

  {#if enquiries.length === 0}
    <p class="muted">{t('ไม่มีใบสอบถาม', 'No enquiries')}</p>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t('เข้ามาเมื่อ', 'Received')}</th>
            <th>{t('สินค้า', 'Product')}</th>
            <th>{t('ผู้ติดต่อ', 'Contact')}</th>
            <th>{t('วันที่ส่ง', 'Delivery')}</th>
            <th>{t('สถานะ', 'Status')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each enquiries as e (e.id)}
            <tr>
              <td>{formatDate(e.createdAt)}</td>
              <td>{lang.pick(e.productNameTh, e.productNameEn)}</td>
              <td>
                {e.contactName}<br />
                <span class="muted">{e.phone}</span>
              </td>
              <td>{formatDate(e.deliveryDate)}</td>
              <td><span class="badge badge-{e.status}">{statusLabel(e.status)}</span></td>
              <td><button class="btn" onclick={() => open(e)}>{t('เปิด', 'Open')}</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Screen>

{#if selected}
  <Modal
    title={t('รายละเอียดใบสอบถาม', 'Enquiry detail')}
    {busy}
    onclose={() => (selected = null)}
    onsave={saveStatus}
  >
    <dl class="detail">
      <dt>{t('สินค้า', 'Product')}</dt>
      <dd>{lang.pick(selected.productNameTh, selected.productNameEn)}</dd>

      <dt>{t('ข้อความบนริบบิ้น', 'Ribbon text')}</dt>
      <dd>{selected.ribbonText}</dd>

      <dt>{t('สถานที่', 'Venue')}</dt>
      <dd>{selected.venue}</dd>

      <dt>{t('วันและเวลาส่ง', 'Delivery')}</dt>
      <dd>{formatDate(selected.deliveryDate)} {selected.deliveryTimeNote ?? ''}</dd>

      <dt>{t('ผู้ติดต่อ', 'Contact')}</dt>
      <dd>
        {selected.contactName} · {selected.phone}
        {#if selected.email}
          · {selected.email}{/if}
        {#if selected.lineId}
          · LINE {selected.lineId}{/if}
      </dd>

      {#if selected.message}
        <dt>{t('ข้อความ', 'Message')}</dt>
        <dd>{selected.message}</dd>
      {/if}
    </dl>

    <label class="field">
      {t('สถานะ', 'Status')}
      <select bind:value={nextStatus}>
        {#each STATUSES as s (s)}
          <option value={s}>{statusLabel(s)}</option>
        {/each}
      </select>
    </label>
  </Modal>
{/if}

<style>
  .field.inline {
    margin-bottom: 0;
  }
  .detail {
    display: grid;
    grid-template-columns: minmax(140px, auto) 1fr;
    gap: 0.375rem var(--space-md);
    margin: 0 0 var(--space-lg);
    font-size: 0.9375rem;
  }
  dt {
    color: var(--slate);
    font-size: 0.8125rem;
  }
  dd {
    margin: 0;
  }
</style>
