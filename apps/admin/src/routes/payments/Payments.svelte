<script lang="ts">
  import { api, ApiRequestError } from '$lib/api';
  import { lang, t, formatSatang, formatDate } from '$lib/i18n.svelte';
  import Screen from '$lib/ui/Screen.svelte';
  import Modal from '$lib/ui/Modal.svelte';

  interface PaymentRow {
    id: string;
    orderId: string;
    orderNo: string;
    rail: string;
    status: string;
    amountSatang: number;
    transRef: string | null;
    verifiedVia: string | null;
    verifiedByAdminId: string | null;
    verifiedReason: string | null;
    verifiedAt: number | null;
    initiatedAt: number;
  }

  const RAIL: Record<string, [string, string]> = {
    promptpay_billpay: ['Bill Payment', 'Bill Payment'],
    promptpay_ewallet: ['PromptPay โอน', 'PromptPay transfer'],
    bank_transfer: ['โอนธนาคาร', 'Bank transfer'],
  };

  const STATUS: Record<string, [string, string]> = {
    pending: ['รอดำเนินการ', 'Pending'],
    awaiting_provider: ['รอผู้ให้บริการ', 'Awaiting provider'],
    verified: ['ยืนยันแล้ว', 'Verified'],
    failed: ['ล้มเหลว', 'Failed'],
    cancelled: ['ยกเลิก', 'Cancelled'],
    refund_recorded: ['บันทึกคืนเงิน', 'Refund recorded'],
  };

  let rows = $state<PaymentRow[]>([]);
  let loading = $state(true);
  let error = $state('');
  let notice = $state('');
  let filterStatus = $state('pending');

  let verifying = $state<PaymentRow | null>(null);
  let reason = $state('');
  let busy = $state(false);

  async function load() {
    loading = true;
    error = '';
    try {
      const qs = filterStatus ? `?status=${encodeURIComponent(filterStatus)}` : '';
      rows = await api<PaymentRow[]>(`/admin/payments${qs}`);
    } catch (err) {
      error =
        err instanceof ApiRequestError
          ? lang.pick(err.message_th, err.message_en)
          : t('โหลดรายการชำระไม่สำเร็จ', 'Could not load payments');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });

  const railOf = (r: string) => lang.pick(...(RAIL[r] ?? [r, r]));
  const statusOf = (s: string) => lang.pick(...(STATUS[s] ?? [s, s]));

  const verifiable = (r: PaymentRow) => r.status === 'pending' || r.status === 'awaiting_provider';

  async function doVerify() {
    if (!verifying) return;
    if (reason.trim().length < 15) {
      error = t(
        'ต้องระบุเหตุผลอย่างน้อย 15 ตัวอักษร',
        'A reason of at least 15 characters is required',
      );
      return;
    }
    busy = true;
    error = '';
    try {
      await api('/payments/manual-verify', {
        method: 'POST',
        body: JSON.stringify({ paymentId: verifying.id, reason: reason.trim() }),
      });
      notice = t('ยืนยันการชำระเงินแล้ว', 'Payment verified');
      verifying = null;
      reason = '';
      await load();
    } catch (err) {
      error =
        err instanceof ApiRequestError
          ? lang.pick(err.message_th, err.message_en)
          : t('ยืนยันไม่สำเร็จ', 'Verification failed');
    } finally {
      busy = false;
    }
  }
</script>

<Screen
  title={t('การชำระเงิน', 'Payments')}
  subtitle={t(
    'ยืนยันการชำระเงินด้วยตนเอง — เฉพาะผู้ดูแลระบบสูงสุด และต้องระบุเหตุผล',
    'Manually verify payments — superadmin only, a typed reason is mandatory',
  )}
  {loading}
  {error}
  {notice}
>
  <div class="toolbar">
    <label class="field inline">
      {t('สถานะ', 'Status')}
      <select bind:value={filterStatus}>
        <option value="pending">{t('รอดำเนินการ', 'Pending')}</option>
        <option value="awaiting_provider">{t('รอผู้ให้บริการ', 'Awaiting provider')}</option>
        <option value="verified">{t('ยืนยันแล้ว', 'Verified')}</option>
        <option value="">{t('ทั้งหมด', 'All')}</option>
      </select>
    </label>
  </div>

  {#if rows.length === 0}
    <p class="muted">{t('ไม่มีรายการชำระเงิน', 'No payments')}</p>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>{t('ช่องทาง', 'Rail')}</th>
            <th class="num">{t('ยอด (บาท)', 'Amount (THB)')}</th>
            <th>{t('สถานะ', 'Status')}</th>
            <th class="num">Ref</th>
            <th>{t('เริ่มชำระ', 'Initiated')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as r (r.id)}
            <tr>
              <td class="num">{r.orderNo}</td>
              <td>{railOf(r.rail)}</td>
              <td class="num">{formatSatang(r.amountSatang)}</td>
              <td><span class="badge badge-{r.status}">{statusOf(r.status)}</span></td>
              <td class="num">{r.transRef ?? '—'}</td>
              <td>{formatDate(r.initiatedAt)}</td>
              <td class="actions">
                {#if verifiable(r)}
                  <button class="btn" onclick={() => (verifying = r)}>
                    {t('ยืนยัน', 'Verify')}
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Screen>

{#if verifying}
  <Modal
    title={`${t('ยืนยันการชำระเงิน', 'Verify payment')} — ${verifying.orderNo}`}
    {busy}
    saveLabel={t('ยืนยัน', 'Verify')}
    onclose={() => (verifying = null)}
    onsave={doVerify}
  >
    <dl class="meta">
      <dt>{t('ยอด', 'Amount')}</dt>
      <dd class="num">{formatSatang(verifying.amountSatang)}</dd>
      <dt>{t('ช่องทาง', 'Rail')}</dt>
      <dd>{railOf(verifying.rail)}</dd>
      <dt>Ref</dt>
      <dd class="num">{verifying.transRef ?? '—'}</dd>
    </dl>
    <label class="field">
      {t('เหตุผล (จำเป็น)', 'Reason (required)')}
      <textarea
        bind:value={reason}
        minlength="15"
        rows="3"
        placeholder={t(
          'อธิบายว่าทำไมจึงยืนยันการชำระด้วยตนเอง เช่น หลักฐานการชำระจากธนาคาร',
          'Why is this payment being manually verified, e.g. bank statement evidence',
        )}></textarea>
    </label>
    <p class="warn-note">
      {t(
        'การยืนยันด้วยตนเองจะบันทึกเป็นเหตุการณ์ "red" ในบันทึกตรวจสอบ ต้องแน่ใจก่อนยืนยัน',
        'Manual verification logs a red audit event — be certain before confirming',
      )}
    </p>
  </Modal>
{/if}

<style>
  .field.inline {
    margin-bottom: 0;
  }
  .actions {
    white-space: nowrap;
  }
  .meta {
    display: grid;
    grid-template-columns: minmax(110px, auto) 1fr;
    gap: 0.25rem var(--space-md);
    margin: 0 0 var(--space-md);
    font-size: 0.875rem;
  }
  dt {
    color: var(--slate);
  }
  dd {
    margin: 0;
  }
  .warn-note {
    color: #b0231a;
    font-size: 0.8rem;
    margin-top: 0.5rem;
  }
</style>
