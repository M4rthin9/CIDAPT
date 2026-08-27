<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let contactName = $state('');
  let contactPhone = $state('');
  let contactEmail = $state('');
  let addrLine1 = $state('');
  let addrLine2 = $state('');
  let subdistrict = $state('');
  let district = $state('');
  let province = $state('');
  let postcode = $state('');
  let shippingNote = $state('');
  let couponCode = $state('');
  let submitting = $state(false);
  let errorMessage = $state('');
  let orderResult = $state<{
    orderId: string;
    orderNo: string;
    totalSatang: number;
    status: string;
  } | null>(null);

  const items = $derived(data.items ?? []);
  const l = $derived(data.lang === 'th' ? 'th' : 'en');
  const t = $derived(
    l === 'th'
      ? {
          title: 'ชำระเงิน',
          contactTitle: 'ข้อมูลติดต่อ',
          name: 'ชื่อ-สกุล',
          phone: 'เบอร์โทร',
          email: 'อีเมล',
          shippingTitle: 'ที่อยู่จัดส่ง',
          addrLine1: 'ที่อยู่ (บ้านเลขที่, ถนน)',
          addrLine2: 'ที่อยู่เพิ่มเติม (หมู่, อาคาร)',
          subdistrict: 'ตำบล/แขวง',
          district: 'อำเภอ/เขต',
          province: 'จังหวัด',
          postcode: 'รหัสไปรษณีย์',
          note: 'หมายเหตุ',
          coupon: 'รหัสส่วนลด',
          itemsTitle: 'สินค้า',
          empty: 'ยังไม่มีสินค้าในตะกร้า',
          submit: 'ยืนยันคำสั่งซื้อ',
          processing: 'กำลังดำเนินการ...',
          successTitle: 'สั่งซื้อสำเร็จ',
          orderNo: 'เลขที่คำสั่งซื้อ',
          payCta: 'ชำระเงิน',
          errorGeneric: 'เกิดข้อผิดพลาด กรุณาลองใหม่',
          backToCart: 'กลับไปตะกร้า',
          goShopping: 'เลือกชมสินค้า',
        }
      : {
          title: 'Checkout',
          contactTitle: 'Contact',
          name: 'Full name',
          phone: 'Phone',
          email: 'Email',
          shippingTitle: 'Shipping address',
          addrLine1: 'Address (number, street)',
          addrLine2: 'Address line 2 (village, building)',
          subdistrict: 'Subdistrict',
          district: 'District',
          province: 'Province',
          postcode: 'Postcode',
          note: 'Note',
          coupon: 'Coupon code',
          itemsTitle: 'Items',
          empty: 'Your cart is empty',
          submit: 'Place order',
          processing: 'Processing...',
          successTitle: 'Order placed',
          orderNo: 'Order No.',
          payCta: 'Pay now',
          errorGeneric: 'An error occurred. Please try again.',
          backToCart: 'Back to cart',
          goShopping: 'Continue shopping',
        },
  );

  async function submitOrder() {
    errorMessage = '';
    submitting = true;
    try {
      const res = await fetch('/api/v1/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          couponCode: couponCode ? couponCode.trim().toUpperCase() : undefined,
          contactName,
          phone: contactPhone,
          email: contactEmail || undefined,
          shipping: {
            addrLine1,
            addrLine2: addrLine2 || undefined,
            subdistrict,
            district,
            province,
            postcode,
          },
          shippingNote: shippingNote || undefined,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        orderResult = json.data;
      } else {
        const json = await res.json();
        errorMessage = json?.error?.message_th
          ? l === 'th'
            ? json.error.message_th
            : json.error.message_en
          : t.errorGeneric;
      }
    } catch {
      errorMessage = t.errorGeneric;
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>{data.lang === 'th' ? 'ชำระเงิน' : 'Checkout'} — CIDA Craft</title>
</svelte:head>

<section class="checkout-page">
  <div class="container">
    {#if orderResult}
      <!-- Order Success -->
      <div class="checkout-success reveal">
        <h1>{t.successTitle}</h1>
        <p class="success-order-no mono">{orderResult.orderNo}</p>
        <p class="success-note">
          {l === 'th'
            ? 'กรุณาชำระเงินภายในเวลาที่กำหนดเพื่อยืนยันคำสั่งซื้อ'
            : 'Please pay within the required time to confirm your order'}
        </p>
      </div>
    {:else}
      <h1 class="checkout-title">{t.title}</h1>

      {#if errorMessage}
        <div class="form-error" role="alert">{errorMessage}</div>
      {/if}

      <form
        class="checkout-form"
        onsubmit={(e) => {
          e.preventDefault();
          submitOrder();
        }}
      >
        <!-- Items -->
        <fieldset class="checkout-section">
          <legend>{t.itemsTitle}</legend>
          {#if items.length > 0}
            <p class="item-count mono">{items.length}</p>
          {:else}
            <p>{t.empty}</p>
            <a href="/{l}" class="empty-link">{t.goShopping}</a>
          {/if}
        </fieldset>

        <!-- Contact -->
        <fieldset class="checkout-section">
          <legend>{t.contactTitle}</legend>

          <div class="form-group">
            <label for="cname">{t.name}</label>
            <input id="cname" type="text" bind:value={contactName} required />
          </div>

          <div class="form-group">
            <label for="cphone">{t.phone}</label>
            <input
              id="cphone"
              type="tel"
              inputmode="tel"
              pattern={'0[0-9]{8,9}'}
              bind:value={contactPhone}
              required
            />
          </div>

          <div class="form-group">
            <label for="cemail">{t.email}</label>
            <input id="cemail" type="email" bind:value={contactEmail} />
          </div>
        </fieldset>

        <!-- Shipping -->
        <fieldset class="checkout-section">
          <legend>{t.shippingTitle}</legend>

          <div class="form-group">
            <label for="addr1">{t.addrLine1}</label>
            <input id="addr1" type="text" bind:value={addrLine1} required />
          </div>

          <div class="form-group">
            <label for="addr2">{t.addrLine2}</label>
            <input id="addr2" type="text" bind:value={addrLine2} />
          </div>

          <div class="form-group">
            <label for="subdistrict">{t.subdistrict}</label>
            <input id="subdistrict" type="text" bind:value={subdistrict} required />
          </div>

          <div class="form-group">
            <label for="district">{t.district}</label>
            <input id="district" type="text" bind:value={district} required />
          </div>

          <div class="form-group">
            <label for="province">{t.province}</label>
            <input id="province" type="text" bind:value={province} required />
          </div>

          <div class="form-group">
            <label for="postcode">{t.postcode}</label>
            <input
              id="postcode"
              type="text"
              inputmode="numeric"
              pattern={'[0-9]{5}'}
              bind:value={postcode}
              required
            />
          </div>

          <div class="form-group">
            <label for="note">{t.note}</label>
            <textarea id="note" bind:value={shippingNote} rows="2"></textarea>
          </div>

          <div class="form-group">
            <label for="coupon">{t.coupon}</label>
            <input id="coupon" type="text" bind:value={couponCode} />
          </div>
        </fieldset>

        <button type="submit" class="btn-primary" disabled={submitting || items.length === 0}>
          {submitting ? t.processing : t.submit}
        </button>
      </form>
    {/if}
  </div>
</section>

<style>
  .checkout-page {
    padding: var(--space-3xl) 0 var(--space-4xl);
  }

  .checkout-title {
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 3vw, 2rem);
    font-weight: 700;
    letter-spacing: -0.025em;
    margin-bottom: var(--space-2xl);
  }

  .checkout-form {
    max-width: 600px;
    display: flex;
    flex-direction: column;
    gap: var(--space-2xl);
  }

  .checkout-section {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: var(--space-xl);
  }

  .checkout-section legend {
    font-weight: 600;
    font-size: 1rem;
    padding: 0 var(--space-sm);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    margin-top: var(--space-md);
  }

  .form-group label {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .form-group input,
  .form-group textarea {
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--line);
    border-radius: 6px;
    font: inherit;
    font-size: 0.875rem;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: 2px solid var(--marigold);
    outline-offset: 1px;
  }

  .empty-link {
    display: inline-block;
    margin-top: var(--space-sm);
    font-size: 0.875rem;
  }

  .form-error {
    padding: var(--space-sm) var(--space-md);
    border-left: 2px solid #b3261e;
    background: rgba(179, 38, 30, 0.06);
    color: #b3261e;
    font-size: 0.875rem;
    margin-bottom: var(--space-lg);
  }

  .btn-primary {
    display: block;
    width: 100%;
    padding: var(--space-md);
    background-color: var(--ink);
    color: var(--paper);
    font-weight: 600;
    border-radius: 8px;
    text-align: center;
    font-size: 1rem;
  }

  .btn-primary:hover {
    opacity: 0.85;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .checkout-success {
    text-align: center;
    padding: var(--space-4xl) 0;
  }

  .checkout-success h1 {
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: var(--space-lg);
  }

  .success-order-no {
    font-size: 1.25rem;
    color: var(--slate);
    margin-bottom: var(--space-xl);
  }

  .mono {
    font-family: var(--font-mono);
  }
</style>
