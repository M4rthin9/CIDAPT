<script lang="ts">
  import { api, ApiRequestError } from '$lib/api';
  import { lang, t, formatSatang, formatDate } from '$lib/i18n.svelte';
  import Screen from '$lib/ui/Screen.svelte';
  import Modal from '$lib/ui/Modal.svelte';

  interface Order {
    id: string;
    orderNo: string;
    status: string;
    contactName: string;
    phone: string;
    email: string | null;
    addrLine1: string;
    addrLine2: string | null;
    subdistrict: string;
    district: string;
    province: string;
    postcode: string;
    shippingNote: string | null;
    subtotalSatang: number;
    discountSatang: number;
    shippingSatang: number;
    totalSatang: number;
    trackingNo: string | null;
    placedAt: number;
    paidAt: number | null;
    shippedAt: number | null;
  }

  interface OrderItem {
    id: string;
    sku: string;
    nameTh: string;
    nameEn: string;
    quantity: number;
    unitPriceSatang: number;
    lineTotalSatang: number;
  }

  const STATUSES = [
    'pending_payment',
    'awaiting_verification',
    'paid',
    'processing',
    'shipped',
    'completed',
    'cancelled',
    'refunded',
  ] as const;

  const STATUS_LABEL: Record<string, [string, string]> = {
    pending_payment: ['รอชำระเงิน', 'Pending payment'],
    awaiting_verification: ['รอตรวจสอบ', 'Awaiting verification'],
    paid: ['ชำระแล้ว', 'Paid'],
    processing: ['กำลังจัดเตรียม', 'Processing'],
    shipped: ['จัดส่งแล้ว', 'Shipped'],
    completed: ['เสร็จสิ้น', 'Completed'],
    cancelled: ['ยกเลิก', 'Cancelled'],
    refunded: ['คืนเงิน', 'Refunded'],
  };

  const statusLabel = (s: string) => {
    const pair = STATUS_LABEL[s];
    return pair ? lang.pick(pair[0], pair[1]) : s;
  };

  let orders = $state<Order[]>([]);
  let loading = $state(true);
  let error = $state('');
  let notice = $state('');

  let filterStatus = $state('');
  let search = $state('');

  // Detail drawer
  let selected = $state<Order | null>(null);
  let items = $state<OrderItem[]>([]);
  let detailBusy = $state(false);
  let nextStatus = $state('');
  let trackingNo = $state('');

  function describe(err: unknown, fallbackTh: string, fallbackEn: string): string {
    return err instanceof ApiRequestError
      ? lang.pick(err.message_th, err.message_en)
      : t(fallbackTh, fallbackEn);
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const qs = new URLSearchParams();
      if (filterStatus) qs.set('status', filterStatus);
      if (search.trim()) qs.set('search', search.trim());
      orders = await api<Order[]>(`/admin/orders${qs.toString() ? `?${qs}` : ''}`);
    } catch (err) {
      error = describe(err, 'โหลดคำสั่งซื้อไม่สำเร็จ', 'Could not load orders');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });

  async function open(order: Order) {
    selected = order;
    nextStatus = order.status;
    trackingNo = order.trackingNo ?? '';
    items = [];
    try {
      const detail = await api<{ order: Order; items: OrderItem[] }>(`/admin/orders/${order.id}`);
      selected = detail.order;
      items = detail.items;
    } catch (err) {
      error = describe(err, 'โหลดรายละเอียดไม่สำเร็จ', 'Could not load order detail');
    }
  }

  async function saveStatus() {
    if (!selected) return;
    detailBusy = true;
    error = '';
    try {
      await api(`/admin/orders/${selected.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          ...(trackingNo.trim() ? { trackingNo: trackingNo.trim() } : {}),
        }),
      });
      notice = t('อัปเดตสถานะแล้ว', 'Status updated');
      selected = null;
      await load();
    } catch (err) {
      error = describe(err, 'อัปเดตสถานะไม่สำเร็จ', 'Could not update status');
    } finally {
      detailBusy = false;
    }
  }
</script>

<Screen
  title={t('คำสั่งซื้อ', 'Orders')}
  subtitle={t('จัดการการชำระเงิน การแพ็ก และการจัดส่ง', 'Payments, packing and shipping pipeline')}
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
    <label class="field inline">
      {t('ค้นหา', 'Search')}
      <input
        type="search"
        bind:value={search}
        placeholder={t('เลขที่ / ชื่อ / เบอร์โทร', 'Order no / name / phone')}
      />
    </label>
  </div>

  {#if orders.length === 0}
    <p class="muted">{t('ไม่มีคำสั่งซื้อ', 'No orders')}</p>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t('เลขที่', 'Order no')}</th>
            <th>{t('ลูกค้า', 'Customer')}</th>
            <th>{t('สถานะ', 'Status')}</th>
            <th class="num">{t('ยอดรวม (บาท)', 'Total (THB)')}</th>
            <th>{t('สั่งเมื่อ', 'Placed')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each orders as order (order.id)}
            <tr>
              <td class="num">{order.orderNo}</td>
              <td>
                {order.contactName}<br />
                <span class="muted">{order.phone}</span>
              </td>
              <td><span class="badge badge-{order.status}">{statusLabel(order.status)}</span></td>
              <td class="num">{formatSatang(order.totalSatang)}</td>
              <td>{formatDate(order.placedAt)}</td>
              <td>
                <button class="btn" onclick={() => open(order)}>{t('จัดการ', 'Manage')}</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Screen>

{#if selected}
  <Modal
    title={t(`คำสั่งซื้อ ${selected.orderNo}`, `Order ${selected.orderNo}`)}
    busy={detailBusy}
    onclose={() => (selected = null)}
    onsave={saveStatus}
  >
    <div class="detail">
      <section>
        <h3>{t('ที่อยู่จัดส่ง', 'Shipping address')}</h3>
        <p class="muted">
          {selected.contactName} · {selected.phone}{selected.email ? ` · ${selected.email}` : ''}<br
          />
          {selected.addrLine1}{selected.addrLine2 ? `, ${selected.addrLine2}` : ''}<br />
          {selected.subdistrict}, {selected.district}, {selected.province}
          {selected.postcode}
          {#if selected.shippingNote}<br />{t('หมายเหตุ', 'Note')}: {selected.shippingNote}{/if}
        </p>
      </section>

      <section>
        <h3>{t('รายการ', 'Items')}</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('สินค้า', 'Product')}</th>
                <th class="num">{t('จำนวน', 'Qty')}</th>
                <th class="num">{t('รวม (บาท)', 'Line total')}</th>
              </tr>
            </thead>
            <tbody>
              {#each items as item (item.id)}
                <tr>
                  <td>
                    {lang.pick(item.nameTh, item.nameEn)}<br />
                    <span class="muted">{item.sku}</span>
                  </td>
                  <td class="num">{item.quantity}</td>
                  <td class="num">{formatSatang(item.lineTotalSatang)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="totals">
          {t('ยอดย่อย', 'Subtotal')}: {formatSatang(selected.subtotalSatang)} ·
          {t('ส่วนลด', 'Discount')}: {formatSatang(selected.discountSatang)} ·
          {t('ค่าส่ง', 'Shipping')}: {formatSatang(selected.shippingSatang)} ·
          <strong>{t('รวม', 'Total')}: {formatSatang(selected.totalSatang)}</strong>
        </p>
      </section>

      <section>
        <h3>{t('อัปเดตสถานะ', 'Update status')}</h3>
        <label class="field">
          {t('สถานะ', 'Status')}
          <select bind:value={nextStatus}>
            {#each STATUSES as s (s)}
              <option value={s}>{statusLabel(s)}</option>
            {/each}
          </select>
        </label>
        <label class="field">
          {t('เลขพัสดุ', 'Tracking number')}
          <input type="text" bind:value={trackingNo} />
        </label>
      </section>
    </div>
  </Modal>
{/if}

<style>
  .field.inline {
    margin-bottom: 0;
  }
  .detail section {
    margin-bottom: var(--space-lg);
  }
  .detail h3 {
    font-size: 0.9375rem;
  }
  .totals {
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }
</style>
