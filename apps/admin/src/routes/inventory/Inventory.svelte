<script lang="ts">
  import { api, ApiRequestError } from '$lib/api';
  import { lang, t, formatDate } from '$lib/i18n.svelte';
  import Screen from '$lib/ui/Screen.svelte';
  import Modal from '$lib/ui/Modal.svelte';

  interface StockRow {
    id: string;
    sku: string;
    nameTh: string;
    nameEn: string;
    stockOnHand: number;
  }

  interface LedgerRow {
    id: string;
    productId: string;
    delta: number;
    reason: string;
    refType: string | null;
    refId: string | null;
    note: string | null;
    createdAt: number;
  }

  // Only these reasons are hand-entered; the rest are written by the order
  // pipeline. The ledger is the sole stock mutation path — there is no
  // "set stock to N" anywhere by design.
  const MANUAL_REASONS = ['production_receipt', 'damage', 'correction'] as const;

  const REASON_LABEL: Record<string, [string, string]> = {
    production_receipt: ['รับเข้าจากการผลิต', 'Production receipt'],
    sale_reserve: ['จองจากการขาย', 'Sale reserve'],
    sale_commit: ['ตัดขาย', 'Sale commit'],
    reserve_release: ['คืนการจอง', 'Reserve release'],
    shipment: ['จัดส่ง', 'Shipment'],
    damage: ['เสียหาย', 'Damage'],
    correction: ['ปรับปรุงยอด', 'Correction'],
  };

  const reasonLabel = (r: string) => {
    const pair = REASON_LABEL[r];
    return pair ? lang.pick(pair[0], pair[1]) : r;
  };

  let stock = $state<StockRow[]>([]);
  let loading = $state(true);
  let error = $state('');
  let notice = $state('');

  let ledgerFor = $state<StockRow | null>(null);
  let ledger = $state<LedgerRow[]>([]);

  let entryFor = $state<StockRow | null>(null);
  let entryDelta = $state(0);
  let entryReason = $state<string>('production_receipt');
  let entryNote = $state('');
  let entryBusy = $state(false);

  function describe(err: unknown, fallbackTh: string, fallbackEn: string): string {
    return err instanceof ApiRequestError
      ? lang.pick(err.message_th, err.message_en)
      : t(fallbackTh, fallbackEn);
  }

  async function load() {
    loading = true;
    error = '';
    try {
      stock = await api<StockRow[]>('/admin/inventory/stock');
    } catch (err) {
      error = describe(err, 'โหลดคลังสินค้าไม่สำเร็จ', 'Could not load stock');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });

  async function openLedger(row: StockRow) {
    ledgerFor = row;
    ledger = [];
    try {
      ledger = await api<LedgerRow[]>(`/admin/inventory?productId=${row.id}`);
    } catch (err) {
      error = describe(err, 'โหลดบัญชีเคลื่อนไหวไม่สำเร็จ', 'Could not load ledger');
    }
  }

  function openEntry(row: StockRow) {
    entryFor = row;
    entryDelta = 0;
    entryReason = 'production_receipt';
    entryNote = '';
  }

  async function saveEntry() {
    if (!entryFor || entryDelta === 0) {
      error = t('จำนวนต้องไม่เป็นศูนย์', 'Delta must be non-zero');
      return;
    }
    entryBusy = true;
    error = '';
    try {
      await api('/admin/inventory', {
        method: 'POST',
        body: JSON.stringify({
          productId: entryFor.id,
          delta: entryDelta,
          reason: entryReason,
          refType: null,
          refId: null,
          note: entryNote.trim() || null,
        }),
      });
      notice = t('บันทึกรายการแล้ว', 'Ledger entry recorded');
      entryFor = null;
      await load();
    } catch (err) {
      error = describe(err, 'บันทึกรายการไม่สำเร็จ', 'Could not record entry');
    } finally {
      entryBusy = false;
    }
  }
</script>

<Screen
  title={t('คลังสินค้า', 'Inventory')}
  subtitle={t(
    'ยอดคงเหลือคำนวณจากบัญชีเคลื่อนไหวเท่านั้น',
    'Stock on hand is derived from the ledger — entries are the only way to move it',
  )}
  {loading}
  {error}
  {notice}
>
  {#if stock.length === 0}
    <p class="muted">{t('ยังไม่มีสินค้า', 'No products yet')}</p>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>{t('สินค้า', 'Product')}</th>
            <th class="num">{t('คงเหลือ', 'On hand')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each stock as row (row.id)}
            <tr>
              <td class="num">{row.sku}</td>
              <td>{lang.pick(row.nameTh, row.nameEn)}</td>
              <td class="num" class:low={row.stockOnHand <= 0}>{row.stockOnHand}</td>
              <td>
                <button class="btn" onclick={() => openEntry(row)}>
                  {t('บันทึกรายการ', 'Add entry')}
                </button>
                <button class="btn" onclick={() => openLedger(row)}>
                  {t('ประวัติ', 'History')}
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Screen>

{#if entryFor}
  <Modal
    title={t(`บันทึกรายการ — ${entryFor.sku}`, `Ledger entry — ${entryFor.sku}`)}
    busy={entryBusy}
    onclose={() => (entryFor = null)}
    onsave={saveEntry}
  >
    <label class="field">
      {t('จำนวน (+ รับเข้า / − ตัดออก)', 'Delta (+ in / − out)')}
      <input type="number" bind:value={entryDelta} step="1" />
    </label>
    <label class="field">
      {t('เหตุผล', 'Reason')}
      <select bind:value={entryReason}>
        {#each MANUAL_REASONS as r (r)}
          <option value={r}>{reasonLabel(r)}</option>
        {/each}
      </select>
    </label>
    <label class="field">
      {t('หมายเหตุ', 'Note')}
      <textarea bind:value={entryNote}></textarea>
    </label>
  </Modal>
{/if}

{#if ledgerFor}
  <Modal
    title={t(`ประวัติ — ${ledgerFor.sku}`, `Ledger — ${ledgerFor.sku}`)}
    onclose={() => (ledgerFor = null)}
  >
    {#if ledger.length === 0}
      <p class="muted">{t('ยังไม่มีรายการ', 'No entries yet')}</p>
    {:else}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t('เมื่อ', 'When')}</th>
              <th class="num">{t('จำนวน', 'Delta')}</th>
              <th>{t('เหตุผล', 'Reason')}</th>
              <th>{t('หมายเหตุ', 'Note')}</th>
            </tr>
          </thead>
          <tbody>
            {#each ledger as row (row.id)}
              <tr>
                <td>{formatDate(row.createdAt)}</td>
                <td class="num">{row.delta > 0 ? `+${row.delta}` : row.delta}</td>
                <td>{reasonLabel(row.reason)}</td>
                <td>{row.note ?? '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </Modal>
{/if}

<style>
  .low {
    color: var(--danger);
    font-weight: 600;
  }
</style>
