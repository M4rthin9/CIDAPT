<script lang="ts">
  import { api, ApiRequestError } from '$lib/api';
  import { lang, t, formatSatang, toDateInput, fromDateInput } from '$lib/i18n.svelte';
  import Screen from '$lib/ui/Screen.svelte';

  interface SummaryRow {
    status: string;
    n: number;
    grossSatang: number;
  }

  const STATUS_LABEL: Record<string, [string, string]> = {
    pending_payment: ['รอชำระเงิน', 'Pending payment'],
    awaiting_verification: ['รอตรวจสอบ', 'Awaiting verification'],
    paid: ['ชำระแล้ว', 'Paid'],
    processing: ['กำลังจัดเตรียม', 'Processing'],
    shipped: ['จัดส่งแล้ว', 'Shipped'],
    completed: ['สำเร็จ', 'Completed'],
    cancelled: ['ยกเลิก', 'Cancelled'],
    refunded: ['คืนเงินแล้ว', 'Refunded'],
  };

  let rows = $state<SummaryRow[]>([]);
  let loading = $state(true);
  let error = $state('');
  let notice = $state('');

  let fromInput = $state(toDateInput(Math.floor(Date.now() / 1000) - 30 * 86400));
  let toInput = $state('');

  const fromUnix = $derived(fromDateInput(fromInput));
  const toUnix = $derived(fromDateInput(toInput));

  const qs = $derived.by(() => {
    const p = new URLSearchParams();
    if (fromUnix) p.set('from', String(fromUnix));
    if (toUnix) p.set('to', String(toUnix));
    return p.toString();
  });

  const totalCount = $derived(rows.reduce((acc, r) => acc + r.n, 0));
  const totalGross = $derived(rows.reduce((acc, r) => acc + r.grossSatang, 0));

  async function load() {
    loading = true;
    error = '';
    try {
      rows = await api<SummaryRow[]>(`/admin/reports/summary${qs ? `?${qs}` : ''}`);
    } catch (err) {
      error =
        err instanceof ApiRequestError
          ? lang.pick(err.message_th, err.message_en)
          : t('โหลดรายงานไม่สำเร็จ', 'Could not load report');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });

  const labelOf = (status: string) => {
    const pair = STATUS_LABEL[status];
    return pair ? lang.pick(pair[0], pair[1]) : status;
  };
</script>

<Screen
  title={t('รายงาน', 'Reports')}
  subtitle={t(
    'สรุปคำสั่งซื้อตามสถานะ และส่งออกเป็น CSV',
    'Order summary by status, exportable as CSV',
  )}
  {loading}
  {error}
  {notice}
>
  {#snippet actions()}
    <a class="btn" href={`/api/v1/admin/reports/orders.csv${qs ? `?${qs}` : ''}`} download>
      {t('ส่งออก CSV', 'Export CSV')}
    </a>
  {/snippet}

  <div class="toolbar">
    <label class="field inline">
      {t('จากวันที่', 'From')}
      <input type="date" bind:value={fromInput} />
    </label>
    <label class="field inline">
      {t('ถึงวันที่', 'To')}
      <input type="date" bind:value={toInput} />
    </label>
  </div>

  {#if rows.length === 0}
    <p class="muted">{t('ไม่มีข้อมูลในช่วงเวลานี้', 'No data in this period')}</p>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t('สถานะ', 'Status')}</th>
            <th class="num">{t('จำนวน', 'Count')}</th>
            <th class="num">{t('ยอดรวม (บาท)', 'Gross (THB)')}</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as r (r.status)}
            <tr>
              <td>{labelOf(r.status)}</td>
              <td class="num">{r.n}</td>
              <td class="num">{formatSatang(r.grossSatang)}</td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <th>{t('รวม', 'Total')}</th>
            <th class="num">{totalCount}</th>
            <th class="num">{formatSatang(totalGross)}</th>
          </tr>
        </tfoot>
      </table>
    </div>
    <p class="muted note">
      {t(
        'ยอดรวมเป็นราคาที่รวมภาษีมูลค่าเพิ่มแล้ว (VAT-inclusive)',
        'Gross totals are VAT-inclusive',
      )}
    </p>
  {/if}
</Screen>

<style>
  .field.inline {
    margin-bottom: 0;
  }
  .note {
    margin-top: 0.75rem;
  }
  tfoot th {
    border-top: 2px solid var(--line, #e2e0db);
  }
</style>
