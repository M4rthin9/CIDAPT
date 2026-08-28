<script lang="ts">
  import { api, ApiRequestError } from '$lib/api';
  import { lang, t, formatSatang, toDateInput, fromDateInput } from '$lib/i18n.svelte';
  import Screen from '$lib/ui/Screen.svelte';
  import Modal from '$lib/ui/Modal.svelte';

  interface Coupon {
    id: string;
    code: string;
    kind: 'percent' | 'fixed';
    valuePercent: number | null;
    valueSatang: number | null;
    startsAt: number | null;
    endsAt: number | null;
    maxRedemptions: number | null;
    active: boolean;
  }

  interface Draft {
    id: string | null;
    code: string;
    kind: 'percent' | 'fixed';
    valuePercent: string;
    valueBaht: string;
    startsAt: string;
    endsAt: string;
    maxRedemptions: string;
    active: boolean;
  }

  let coupons = $state<Coupon[]>([]);
  let loading = $state(true);
  let error = $state('');
  let notice = $state('');
  let draft = $state<Draft | null>(null);
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
      coupons = await api<Coupon[]>('/admin/coupons');
    } catch (err) {
      error = describe(err, 'โหลดคูปองไม่สำเร็จ', 'Could not load coupons');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });

  function newCoupon() {
    draft = {
      id: null,
      code: '',
      kind: 'percent',
      valuePercent: '',
      valueBaht: '',
      startsAt: '',
      endsAt: '',
      maxRedemptions: '',
      active: true,
    };
  }

  function edit(c: Coupon) {
    draft = {
      id: c.id,
      code: c.code,
      kind: c.kind,
      valuePercent: c.valuePercent === null ? '' : String(c.valuePercent),
      valueBaht: c.valueSatang === null ? '' : String(c.valueSatang / 100),
      startsAt: toDateInput(c.startsAt),
      endsAt: toDateInput(c.endsAt),
      maxRedemptions: c.maxRedemptions === null ? '' : String(c.maxRedemptions),
      active: c.active,
    };
  }

  /**
   * `couponUpsertSchema` requires exactly one of percent/fixed to be set, so the
   * unused half is always sent as null rather than left over from the last edit.
   */
  function toBody(d: Draft) {
    return {
      code: d.code.trim().toUpperCase(),
      kind: d.kind,
      valuePercent: d.kind === 'percent' ? Number(d.valuePercent) : null,
      valueSatang: d.kind === 'fixed' ? Math.round(Number(d.valueBaht) * 100) : null,
      startsAt: fromDateInput(d.startsAt),
      endsAt: fromDateInput(d.endsAt),
      maxRedemptions: d.maxRedemptions.trim() === '' ? null : Number(d.maxRedemptions),
      active: d.active,
    };
  }

  async function save() {
    if (!draft) return;
    busy = true;
    error = '';
    try {
      const body = JSON.stringify(toBody(draft));
      if (draft.id) {
        await api(`/admin/coupons/${draft.id}`, { method: 'PUT', body });
      } else {
        await api('/admin/coupons', { method: 'POST', body });
      }
      notice = t('บันทึกคูปองแล้ว', 'Coupon saved');
      draft = null;
      await load();
    } catch (err) {
      error = describe(err, 'บันทึกคูปองไม่สำเร็จ', 'Could not save coupon');
    } finally {
      busy = false;
    }
  }

  let pendingDelete = $state<Coupon | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) return;
    busy = true;
    error = '';
    try {
      await api(`/admin/coupons/${pendingDelete.id}`, { method: 'DELETE' });
      notice = t('ลบคูปองแล้ว', 'Coupon deleted');
      pendingDelete = null;
      await load();
    } catch (err) {
      error = describe(err, 'ลบคูปองไม่สำเร็จ', 'Could not delete coupon');
    } finally {
      busy = false;
    }
  }

  const valueOf = (c: Coupon) =>
    c.kind === 'percent' ? `${c.valuePercent ?? 0}%` : `฿${formatSatang(c.valueSatang)}`;
</script>

<Screen
  title={t('คูปอง', 'Coupons')}
  subtitle={t('ส่วนลดที่ใช้ตอนชำระเงิน', 'Discounts applied at checkout')}
  {loading}
  {error}
  {notice}
>
  {#snippet actions()}
    <button class="btn btn-primary" onclick={newCoupon}>{t('เพิ่มคูปอง', 'New coupon')}</button>
  {/snippet}

  {#if coupons.length === 0}
    <p class="muted">{t('ยังไม่มีคูปอง', 'No coupons yet')}</p>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t('รหัส', 'Code')}</th>
            <th>{t('ชนิด', 'Kind')}</th>
            <th class="num">{t('มูลค่า', 'Value')}</th>
            <th class="num">{t('จำกัดการใช้', 'Max uses')}</th>
            <th>{t('สถานะ', 'Status')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each coupons as c (c.id)}
            <tr>
              <td class="num">{c.code}</td>
              <td>{c.kind === 'percent' ? t('เปอร์เซ็นต์', 'Percent') : t('จำนวนเงิน', 'Fixed')}</td
              >
              <td class="num">{valueOf(c)}</td>
              <td class="num">{c.maxRedemptions ?? '∞'}</td>
              <td>
                <span class="badge badge-{c.active ? 'published' : 'archived'}">
                  {c.active ? t('ใช้งาน', 'Active') : t('ปิด', 'Inactive')}
                </span>
              </td>
              <td class="actions">
                <button class="btn" onclick={() => edit(c)}>{t('แก้ไข', 'Edit')}</button>
                <button class="btn btn-danger" onclick={() => (pendingDelete = c)}>
                  {t('ลบ', 'Delete')}
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Screen>

{#if draft}
  <Modal
    title={draft.id ? t('แก้ไขคูปอง', 'Edit coupon') : t('เพิ่มคูปอง', 'New coupon')}
    {busy}
    onclose={() => (draft = null)}
    onsave={save}
  >
    <div class="field-row">
      <label class="field">
        {t('รหัส', 'Code')}
        <input type="text" bind:value={draft.code} placeholder="SONGKRAN10" />
      </label>
      <label class="field">
        {t('ชนิด', 'Kind')}
        <select bind:value={draft.kind}>
          <option value="percent">{t('เปอร์เซ็นต์', 'Percent')}</option>
          <option value="fixed">{t('จำนวนเงิน', 'Fixed amount')}</option>
        </select>
      </label>
      {#if draft.kind === 'percent'}
        <label class="field">
          {t('ส่วนลด (%)', 'Discount (%)')}
          <input type="number" min="1" max="100" step="1" bind:value={draft.valuePercent} />
        </label>
      {:else}
        <label class="field">
          {t('ส่วนลด (บาท)', 'Discount (THB)')}
          <input type="number" min="0" step="0.01" bind:value={draft.valueBaht} />
        </label>
      {/if}
      <label class="field">
        {t('เริ่ม', 'Starts')}
        <input type="date" bind:value={draft.startsAt} />
      </label>
      <label class="field">
        {t('สิ้นสุด', 'Ends')}
        <input type="date" bind:value={draft.endsAt} />
      </label>
      <label class="field">
        {t('จำกัดการใช้', 'Max redemptions')}
        <input type="number" min="1" step="1" bind:value={draft.maxRedemptions} />
      </label>
    </div>
    <label class="check">
      <input type="checkbox" bind:checked={draft.active} />
      {t('เปิดใช้งาน', 'Active')}
    </label>
  </Modal>
{/if}

{#if pendingDelete}
  <Modal
    title={t('ยืนยันการลบ', 'Confirm delete')}
    {busy}
    saveLabel={t('ลบ', 'Delete')}
    onclose={() => (pendingDelete = null)}
    onsave={confirmDelete}
  >
    <p>
      {t(`ต้องการลบคูปอง ${pendingDelete.code} หรือไม่?`, `Delete coupon ${pendingDelete.code}?`)}
    </p>
  </Modal>
{/if}

<style>
  .actions {
    white-space: nowrap;
  }
  .actions .btn + .btn {
    margin-left: 0.25rem;
  }
</style>
