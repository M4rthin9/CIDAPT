<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const product = $derived(data.product);
  const lang = $derived(data.lang);
  const isEnquiry = $derived(product?.purchaseMode === 'enquiry');
  const isFloral = $derived(data.division === 'florals');
  const reveal = $derived(isFloral ? '' : 'reveal');
  const reveal1 = $derived(isFloral ? '' : 'reveal reveal-delay-1');
  const reveal2 = $derived(isFloral ? '' : 'reveal reveal-delay-2');

  let quantity = $state(1);
  let cartMessage = $state('');

  const divisionName = $derived(data.divisionName);
  const material = $derived(lang === 'th' ? product?.material_th : product?.material_en);
  const handFinish = $derived(lang === 'th' ? product?.handFinish_th : product?.handFinish_en);

  // Enquiry form state
  let enquiryName = $state('');
  let enquiryPhone = $state('');
  let enquiryRibbon = $state('');
  let enquiryVenue = $state('');
  let enquiryDate = $state('');
  let enquiryMessage = $state('');
  let enquirySubmitted = $state(false);
  let enquiryError = $state('');
  let enquirySending = $state(false);

  async function addToCart() {
    if (!product) return;

    try {
      const res = await fetch('/api/v1/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity }),
      });

      if (res.ok) {
        cartMessage = lang === 'th' ? 'เพิ่มลงตะกร้าแล้ว' : 'Added to cart';
      } else {
        const json = await res.json().catch(() => null);
        cartMessage =
          (lang === 'th' ? json?.error?.message_th : json?.error?.message_en) ??
          (lang === 'th' ? 'ไม่สามารถเพิ่มได้' : 'Could not add to cart');
      }
    } catch {
      cartMessage = lang === 'th' ? 'เกิดข้อผิดพลาด' : 'Error occurred';
    }

    setTimeout(() => {
      cartMessage = '';
    }, 3000);
  }

  async function submitEnquiry() {
    if (!product) return;

    enquiryError = '';
    enquirySending = true;

    // API expects a Unix timestamp in seconds; the date input gives YYYY-MM-DD.
    const deliveryTs = enquiryDate ? Math.floor(new Date(enquiryDate).getTime() / 1000) : undefined;

    try {
      const res = await fetch('/api/v1/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          contactName: enquiryName,
          phone: enquiryPhone,
          ribbonText: enquiryRibbon,
          venue: enquiryVenue,
          deliveryDate: deliveryTs,
          message: enquiryMessage || undefined,
        }),
      });

      if (res.ok) {
        enquirySubmitted = true;
      } else {
        const json = await res.json().catch(() => null);
        enquiryError =
          (lang === 'th' ? json?.error?.message_th : json?.error?.message_en) ??
          (lang === 'th' ? 'ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่' : 'Could not send. Please try again.');
      }
    } catch {
      enquiryError =
        lang === 'th' ? 'ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่' : 'Could not send. Please try again.';
    } finally {
      enquirySending = false;
    }
  }
</script>

<svelte:head>
  <title>{product ? (lang === 'th' ? product.name_th : product.name_en) : ''} — CIDA Craft</title>
</svelte:head>

{#if product}
  <section class="pdp">
    <div class="container">
      <nav class="breadcrumb" aria-label={lang === 'th' ? 'เส้นทาง' : 'Breadcrumb'}>
        <a href="/{lang}">{lang === 'th' ? 'หน้าแรก' : 'Home'}</a>
        <span class="breadcrumb-sep">/</span>
        <a href="/{lang}/{data.division}">{divisionName}</a>
        <span class="breadcrumb-sep">/</span>
        <a href="/{lang}/{data.division}/{data.categorySlug}">{data.categoryName}</a>
        <span class="breadcrumb-sep">/</span>
        <span>{lang === 'th' ? product.name_th : product.name_en}</span>
      </nav>

      <div class="pdp-grid">
        <!-- Product Image -->
        <div class="pdp-image {reveal}">
          <div class="pdp-img-placeholder"></div>
        </div>

        <!-- Product Info -->
        <div class="pdp-info">
          <h1 class="pdp-title {reveal}">{lang === 'th' ? product.name_th : product.name_en}</h1>

          <p class="pdp-price {reveal1}">
            <span class="price-mono">{product.priceFormatted}</span>
          </p>

          <p class="pdp-desc {reveal1}">
            {lang === 'th' ? product.description_th : product.description_en}
          </p>

          <!-- Workshop Plate -->
          <div class="workshop-plate {reveal2}">
            <div class="plate-row">
              <span class="plate-label">{lang === 'th' ? 'กองงาน' : 'Workshop'}</span>
              <span class="plate-value">{divisionName}</span>
            </div>
            {#if product.lotCode}
              <div class="plate-row">
                <span class="plate-label">{lang === 'th' ? 'ล็อต' : 'Lot'}</span>
                <span class="plate-value mono">{product.lotCode}</span>
              </div>
            {/if}
            {#if material}
              <div class="plate-row">
                <span class="plate-label">{lang === 'th' ? 'วัสดุ' : 'Material'}</span>
                <span class="plate-value">{material}</span>
              </div>
            {/if}
            {#if handFinish}
              <div class="plate-row">
                <span class="plate-label">{lang === 'th' ? 'งานทำมือ' : 'Finish'}</span>
                <span class="plate-value">{handFinish}</span>
              </div>
            {/if}
          </div>

          {#if isEnquiry}
            <!-- Enquiry Form for Florals -->
            <div class="enquiry-section {reveal2}">
              <p class="enquiry-note">
                {lang === 'th'
                  ? 'ติดต่อเจ้าหน้าที่เพื่อสั่งซื้อ'
                  : 'Contact an officer to place your order'}
              </p>

              {#if enquirySubmitted}
                <div class="enquiry-success" role="alert">
                  {lang === 'th'
                    ? 'ได้รับข้อมูลแล้ว เจ้าหน้าที่จะติดต่อกลับ'
                    : 'Received. An officer will contact you shortly.'}
                </div>
              {:else}
                <form
                  class="enquiry-form"
                  onsubmit={(e) => {
                    e.preventDefault();
                    submitEnquiry();
                  }}
                >
                  <div class="form-group">
                    <label for="name">{lang === 'th' ? 'ชื่อ' : 'Name'}</label>
                    <input id="name" type="text" bind:value={enquiryName} required />
                  </div>
                  <div class="form-group">
                    <label for="phone">{lang === 'th' ? 'เบอร์โทร' : 'Phone'}</label>
                    <input
                      id="phone"
                      type="tel"
                      inputmode="tel"
                      pattern={'0[0-9]{8,9}'}
                      bind:value={enquiryPhone}
                      required
                    />
                  </div>
                  <div class="form-group">
                    <label for="ribbon"
                      >{lang === 'th' ? 'ข้อความบนพวงมาลัย/พวงหรีด' : 'Ribbon text'}</label
                    >
                    <input id="ribbon" type="text" bind:value={enquiryRibbon} required />
                  </div>
                  <div class="form-group">
                    <label for="venue">{lang === 'th' ? 'สถานที่' : 'Venue'}</label>
                    <input id="venue" type="text" bind:value={enquiryVenue} required />
                  </div>
                  <div class="form-group">
                    <label for="date">{lang === 'th' ? 'วันที่ต้องการ' : 'Desired date'}</label>
                    <input id="date" type="date" bind:value={enquiryDate} />
                  </div>
                  <div class="form-group">
                    <label for="msg"
                      >{lang === 'th' ? 'ข้อความเพิ่มเติม' : 'Additional message'}</label
                    >
                    <textarea id="msg" bind:value={enquiryMessage} rows="3"></textarea>
                  </div>
                  {#if enquiryError}
                    <div class="form-error" role="alert">{enquiryError}</div>
                  {/if}

                  <button type="submit" class="btn-primary" disabled={enquirySending}>
                    {enquirySending
                      ? lang === 'th'
                        ? 'กำลังส่ง...'
                        : 'Sending...'
                      : lang === 'th'
                        ? 'ส่งข้อมูล'
                        : 'Submit enquiry'}
                  </button>
                </form>
              {/if}

              <div class="enquiry-contacts">
                <p>{lang === 'th' ? 'หรือโทร' : 'Or call'}</p>
                <a href="tel:029675100">0-2967-5100</a>
              </div>
            </div>
          {:else}
            <!-- Cart: Add to Cart -->
            <div class="cart-section {reveal2}">
              <div class="quantity-row">
                <label for="qty" class="visually-hidden"
                  >{lang === 'th' ? 'จำนวน' : 'Quantity'}</label
                >
                <button
                  class="qty-btn"
                  onclick={() => {
                    if (quantity > 1) quantity--;
                  }}
                  aria-label={lang === 'th' ? 'ลดจำนวน' : 'Decrease'}>-</button
                >
                <span class="qty-value" aria-live="polite">{quantity}</span>
                <button
                  class="qty-btn"
                  onclick={() => quantity++}
                  aria-label={lang === 'th' ? 'เพิ่มจำนวน' : 'Increase'}>+</button
                >
              </div>

              <button class="btn-primary" onclick={addToCart}>
                {lang === 'th' ? 'เพิ่มลงตะกร้า' : 'Add to cart'}
              </button>

              {#if cartMessage}
                <div class="cart-msg" role="status" aria-live="polite">{cartMessage}</div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </section>
{:else}
  <section class="not-found container">
    <h1>{lang === 'th' ? 'ไม่พบสินค้า' : 'Product not found'}</h1>
  </section>
{/if}

<style>
  .pdp {
    padding: var(--space-2xl) 0 var(--space-4xl);
  }

  .breadcrumb {
    font-size: 0.875rem;
    color: var(--slate);
    margin-bottom: var(--space-xl);
  }

  .breadcrumb a {
    color: var(--slate);
  }
  .breadcrumb a:hover {
    color: var(--marigold);
  }
  .breadcrumb-sep {
    margin: 0 var(--space-sm);
    color: var(--line);
  }

  .pdp-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3xl);
    align-items: start;
  }

  .pdp-img-placeholder {
    aspect-ratio: 1;
    background: linear-gradient(135deg, var(--mist) 0%, var(--line) 100%);
    border-radius: 12px;
  }

  .pdp-title {
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 3vw, 2rem);
    font-weight: 700;
    letter-spacing: -0.025em;
    margin-bottom: var(--space-md);
  }

  .pdp-price {
    font-size: 1.5rem;
    color: var(--ink);
    margin-bottom: var(--space-lg);
  }

  .price-mono {
    font-family: var(--font-mono);
  }

  .pdp-desc {
    font-size: 1rem;
    color: var(--slate);
    line-height: 1.75;
    margin-bottom: var(--space-xl);
  }

  /* Workshop Plate — signature element */
  .workshop-plate {
    border: 2px solid var(--ink);
    border-radius: 8px;
    padding: var(--space-lg);
    margin-bottom: var(--space-xl);
    font-family: var(--font-mono), 'Anuphan', sans-serif;
    font-size: 0.875rem;
  }

  .plate-row {
    display: flex;
    justify-content: space-between;
    padding: var(--space-xs) 0;
  }

  .plate-row + .plate-row {
    border-top: 1px solid var(--line);
  }

  .form-error {
    padding: var(--space-sm) var(--space-md);
    border-left: 2px solid #b3261e;
    background: rgba(179, 38, 30, 0.06);
    color: #b3261e;
    font-size: 0.875rem;
    margin-bottom: var(--space-md);
  }

  .plate-label {
    color: var(--slate);
    font-size: 0.75rem;
    letter-spacing: 0.05em;
  }

  .plate-value {
    font-weight: 500;
  }

  .mono {
    font-family: var(--font-mono);
  }

  /* Cart */
  .cart-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    max-width: 320px;
  }

  .quantity-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .qty-btn {
    width: 40px;
    height: 40px;
    border: 1px solid var(--line);
    border-radius: 8px;
    font-size: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: var(--transition-colors);
  }

  .qty-btn:hover {
    border-color: var(--ink);
  }

  .qty-value {
    font-family: var(--font-mono);
    font-size: 1.125rem;
    min-width: 2rem;
    text-align: center;
  }

  .btn-primary {
    padding: var(--space-md) var(--space-xl);
    background-color: var(--ink);
    color: var(--paper);
    font-weight: 600;
    border-radius: 8px;
    text-align: center;
    transition: opacity var(--duration-fast) ease;
  }

  .btn-primary:hover {
    opacity: 0.85;
  }

  .cart-msg {
    font-size: 0.875rem;
    color: var(--marigold);
    text-align: center;
  }

  /* Enquiry */
  .enquiry-section {
    max-width: 480px;
  }

  .enquiry-note {
    font-size: 1rem;
    font-weight: 500;
    color: var(--ink);
    margin-bottom: var(--space-lg);
    padding: var(--space-md);
    background-color: var(--mist);
    border-radius: 8px;
  }

  .enquiry-success {
    padding: var(--space-md);
    background-color: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    color: #166534;
    margin-bottom: var(--space-lg);
  }

  .enquiry-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .form-group label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--ink);
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

  .enquiry-contacts {
    margin-top: var(--space-lg);
    font-size: 0.875rem;
    color: var(--slate);
  }

  .enquiry-contacts a {
    font-family: var(--font-mono);
    margin-left: var(--space-sm);
  }

  .not-found {
    padding: var(--space-4xl) 0;
    text-align: center;
    color: var(--slate);
  }

  @media (max-width: 768px) {
    .pdp-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
