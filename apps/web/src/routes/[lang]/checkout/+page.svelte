<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let shippingName = $state('');
  let shippingAddress = $state('');
  let shippingPhone = $state('');
  let paymentMethod = $state('promptpay_billpay');
  let submitting = $state(false);
  let orderResult = $state<{ orderNo: string; paymentUrl: string } | null>(null);

  async function submitOrder() {
    submitting = true;
    try {
      const res = await fetch('/api/v1/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipping: {
            name: shippingName,
            address: shippingAddress,
            phone: shippingPhone,
          },
          paymentMethod,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        orderResult = json.data;
      }
    } catch {
      // Handle error
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
        <h1>{data.lang === 'th' ? 'สั่งซื้อสำเร็จ' : 'Order placed'}</h1>
        <p class="success-order-no mono">{orderResult.orderNo}</p>
        <a href={orderResult.paymentUrl} class="btn-primary">
          {data.lang === 'th' ? 'ชำระเงิน' : 'Pay now'}
        </a>
      </div>
    {:else}
      <h1 class="checkout-title">{data.lang === 'th' ? 'ชำระเงิน' : 'Checkout'}</h1>

      <form
        class="checkout-form"
        onsubmit={(e) => {
          e.preventDefault();
          submitOrder();
        }}
      >
        <!-- Shipping -->
        <fieldset class="checkout-section">
          <legend>{data.lang === 'th' ? 'ที่อยู่จัดส่ง' : 'Shipping address'}</legend>

          <div class="form-group">
            <label for="name">{data.lang === 'th' ? 'ชื่อ-สกุล' : 'Full name'}</label>
            <input id="name" type="text" bind:value={shippingName} required />
          </div>

          <div class="form-group">
            <label for="phone">{data.lang === 'th' ? 'เบอร์โทร' : 'Phone'}</label>
            <input id="phone" type="tel" bind:value={shippingPhone} required />
          </div>

          <div class="form-group">
            <label for="address">{data.lang === 'th' ? 'ที่อยู่' : 'Address'}</label>
            <textarea id="address" bind:value={shippingAddress} rows="3" required></textarea>
          </div>
        </fieldset>

        <!-- Payment -->
        <fieldset class="checkout-section">
          <legend>{data.lang === 'th' ? 'วิธีชำระเงิน' : 'Payment method'}</legend>

          <label class="radio-option">
            <input
              type="radio"
              name="payment"
              value="promptpay_billpay"
              bind:group={paymentMethod}
            />
            <span class="radio-label">PromptPay (Bill Payment)</span>
          </label>

          <label class="radio-option">
            <input
              type="radio"
              name="payment"
              value="promptpay_ewallet"
              bind:group={paymentMethod}
            />
            <span class="radio-label">PromptPay (eWallet)</span>
          </label>

          <label class="radio-option">
            <input type="radio" name="payment" value="bank_transfer" bind:group={paymentMethod} />
            <span class="radio-label">{data.lang === 'th' ? 'โอนผ่านธนาคาร' : 'Bank transfer'}</span
            >
          </label>
        </fieldset>

        <button type="submit" class="btn-primary" disabled={submitting}>
          {submitting
            ? data.lang === 'th'
              ? 'กำลังดำเนินการ...'
              : 'Processing...'
            : data.lang === 'th'
              ? 'ยืนยันคำสั่งซื้อ'
              : 'Place order'}
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

  .radio-option {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) 0;
    cursor: pointer;
  }

  .radio-label {
    font-size: 0.875rem;
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

  .checkout-success .btn-primary {
    max-width: 320px;
    margin: 0 auto;
  }
</style>
