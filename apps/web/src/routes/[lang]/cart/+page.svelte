<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  type CartItem = {
    productId: string;
    name_th: string;
    name_en: string;
    priceSatang: number;
    priceFormatted: string;
    quantity: number;
  };

  // Local working copy so quantity edits are instant; resynced whenever the loader reruns.
  let items = $state<CartItem[]>([]);
  $effect(() => {
    items = data.cart?.items ?? [];
  });
  let loading = $state(false);
  let cartStatus = $state('');

  const total = $derived(
    items.reduce(
      (sum: number, item: { priceSatang: number; quantity: number }) =>
        sum + item.priceSatang * item.quantity,
      0,
    ),
  );
  const totalFormatted = $derived(`฿${(total / 100).toFixed(2)}`);

  async function updateQuantity(productId: string, delta: number) {
    loading = true;
    try {
      const item = items.find((i: { productId: string }) => i.productId === productId);
      if (!item) return;

      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        await fetch(`/api/v1/cart/items/${productId}`, { method: 'DELETE' });
        items = items.filter((i: { productId: string }) => i.productId !== productId);
        cartStatus = data.lang === 'th' ? 'ลบสินค้าออกจากตะกร้าแล้ว' : 'Item removed from cart';
      } else {
        const res = await fetch(`/api/v1/cart/items/${productId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: newQty }),
        });
        if (res.ok) {
          item.quantity = newQty;
          cartStatus =
            data.lang === 'th' ? `อัปเดตจำนวนเป็น ${newQty} แล้ว` : `Quantity updated to ${newQty}`;
        } else {
          cartStatus = data.lang === 'th' ? 'อัปเดตไม่สำเร็จ' : 'Could not update cart';
        }
      }
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>{data.lang === 'th' ? 'ตะกร้า' : 'Cart'} — CIDA Craft</title>
</svelte:head>

<section class="cart-page">
  <div class="container">
    <h1 class="cart-title">{data.lang === 'th' ? 'ตะกร้าสินค้า' : 'Shopping Cart'}</h1>

    <div class="cart-status" role="status" aria-live="polite">{cartStatus}</div>

    {#if items.length === 0}
      <div class="cart-empty">
        <p>{data.lang === 'th' ? 'ยังไม่มีสินค้าในตะกร้า' : 'Your cart is empty'}</p>
        <a href="/{data.lang}" class="btn-outline">
          {data.lang === 'th' ? 'เลือกชมสินค้า' : 'Continue shopping'}
        </a>
      </div>
    {:else}
      <div class="cart-grid">
        <div class="cart-items">
          {#each items as item}
            <div class="cart-item">
              <div class="item-img"></div>
              <div class="item-info">
                <h2 class="item-name">{data.lang === 'th' ? item.name_th : item.name_en}</h2>
                <p class="item-price">{item.priceFormatted}</p>
                <div class="item-qty">
                  <button
                    class="qty-btn"
                    onclick={() => updateQuantity(item.productId, -1)}
                    aria-label={data.lang === 'th' ? 'ลดจำนวน' : 'Decrease quantity'}
                    disabled={loading}>-</button
                  >
                  <span class="qty-value">{item.quantity}</span>
                  <button
                    class="qty-btn"
                    onclick={() => updateQuantity(item.productId, 1)}
                    aria-label={data.lang === 'th' ? 'เพิ่มจำนวน' : 'Increase quantity'}
                    disabled={loading}>+</button
                  >
                </div>
                <button
                  class="item-remove"
                  onclick={() => updateQuantity(item.productId, -item.quantity)}
                  aria-label={data.lang === 'th' ? 'ลบออกจากตะกร้า' : 'Remove from cart'}
                  disabled={loading}
                >
                  ×
                </button>
              </div>
              <p class="item-subtotal">{((item.priceSatang * item.quantity) / 100).toFixed(2)} ฿</p>
            </div>
          {/each}
        </div>

        <aside class="cart-summary">
          <div class="summary-row">
            <span>{data.lang === 'th' ? 'รวม' : 'Subtotal'}</span>
            <span class="mono">{totalFormatted}</span>
          </div>
          <a href="/{data.lang}/checkout" class="btn-primary" role="button">
            {data.lang === 'th' ? 'ดำเนินการชำระเงิน' : 'Proceed to checkout'}
          </a>
        </aside>
      </div>
    {/if}
  </div>
</section>

<style>
  .cart-page {
    padding: var(--space-3xl) 0 var(--space-4xl);
  }

  .cart-title {
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 3vw, 2rem);
    font-weight: 700;
    letter-spacing: -0.025em;
    margin-bottom: var(--space-2xl);
  }

  .cart-empty {
    text-align: center;
    padding: var(--space-4xl) 0;
  }

  .cart-empty p {
    color: var(--slate);
    font-size: 1.125rem;
    margin-bottom: var(--space-xl);
  }

  .cart-grid {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: var(--space-3xl);
    align-items: start;
  }

  .cart-status {
    min-height: 1.5rem;
    font-size: 0.875rem;
    color: var(--slate);
    margin-bottom: var(--space-md);
  }

  .cart-item {
    display: grid;
    grid-template-columns: 80px 1fr auto auto;
    gap: var(--space-lg);
    padding: var(--space-lg) 0;
    border-bottom: 1px solid var(--line);
    align-items: start;
  }

  .item-img {
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, var(--mist) 0%, var(--line) 100%);
    border-radius: 8px;
  }

  .item-name {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: var(--space-xs);
  }

  .item-price {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--slate);
    margin-bottom: var(--space-sm);
  }

  .item-qty {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .qty-btn {
    width: 32px;
    height: 32px;
    border: 1px solid var(--line);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .qty-value {
    font-family: var(--font-mono);
    min-width: 2rem;
    text-align: center;
  }

  .item-subtotal {
    font-family: var(--font-mono);
    font-weight: 600;
  }

  .item-remove {
    background: none;
    border: none;
    font-size: 1.25rem;
    line-height: 1;
    color: var(--slate);
    cursor: pointer;
    padding: var(--space-xs);
  }

  .item-remove:hover {
    color: var(--ink);
  }

  .cart-summary {
    position: sticky;
    top: calc(var(--nav-height) + var(--space-xl));
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: var(--space-xl);
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: var(--space-xl);
  }

  .mono {
    font-family: var(--font-mono);
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
    text-decoration: none;
  }

  .btn-primary:hover {
    opacity: 0.85;
    text-decoration: none;
  }

  .btn-outline {
    display: inline-block;
    padding: var(--space-md) var(--space-xl);
    border: 1px solid var(--ink);
    color: var(--ink);
    font-weight: 600;
    border-radius: 8px;
    text-decoration: none;
  }

  .btn-outline:hover {
    background-color: var(--ink);
    color: var(--paper);
    text-decoration: none;
  }

  @media (max-width: 768px) {
    .cart-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
