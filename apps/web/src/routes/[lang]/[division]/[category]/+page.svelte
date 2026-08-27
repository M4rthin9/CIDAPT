<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title
    >{data.lang === 'th' ? (data.category?.name_th ?? '') : (data.category?.name_en ?? '')} — CIDA Craft</title
  >
</svelte:head>

<section class="category-hero">
  <div class="container">
    <nav class="breadcrumb" aria-label={data.lang === 'th' ? 'เส้นทาง' : 'Breadcrumb'}>
      <a href="/{data.lang}">{data.lang === 'th' ? 'หน้าแรก' : 'Home'}</a>
      <span class="breadcrumb-sep">/</span>
      <a href="/{data.lang}/{data.division}"
        >{data.lang === 'th' ? data.divisionName_th : data.divisionName_en}</a
      >
      <span class="breadcrumb-sep">/</span>
      <span>{data.lang === 'th' ? data.category?.name_th : data.category?.name_en}</span>
    </nav>

    <h1 class="category-title reveal">
      {data.lang === 'th' ? data.category?.name_th : data.category?.name_en}
    </h1>
  </div>
</section>

<section class="products">
  <div class="container">
    {#if data.products?.length}
      <div class="product-grid">
        {#each data.products as product, i}
          <a
            href="/{data.lang}/{data.division}/{data.categorySlug}/{data.lang === 'th'
              ? product.slug_th
              : product.slug_en}"
            class="product-card reveal reveal-delay-{(i % 3) + 1}"
          >
            <div class="product-img"></div>
            <div class="product-info">
              <h2 class="product-name">
                {data.lang === 'th' ? product.name_th : product.name_en}
              </h2>
              <p class="product-price">{product.priceFormatted}</p>
            </div>
          </a>
        {/each}
      </div>
    {:else}
      <p class="empty-state">
        {data.lang === 'th' ? 'ยังไม่มีสินค้าในหมวดนี้' : 'No products yet'}
      </p>
    {/if}
  </div>
</section>

<style>
  .category-hero {
    padding: var(--space-2xl) 0 var(--space-xl);
    background-color: var(--mist);
  }

  .breadcrumb {
    font-size: 0.875rem;
    color: var(--slate);
    margin-bottom: var(--space-lg);
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

  .category-title {
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 700;
    letter-spacing: -0.025em;
  }

  .products {
    padding: var(--space-3xl) 0;
  }

  .product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space-xl);
  }

  .product-card {
    display: block;
    text-decoration: none;
    color: inherit;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: box-shadow var(--duration-fast) ease;
  }

  .product-card:hover {
    box-shadow: var(--shadow-md);
    text-decoration: none;
  }

  .product-img {
    aspect-ratio: 1;
    background: linear-gradient(135deg, var(--mist) 0%, var(--line) 100%);
  }

  .product-info {
    padding: var(--space-md) var(--space-lg);
  }

  .product-name {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: var(--space-xs);
  }

  .product-price {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--slate);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-4xl) 0;
    color: var(--slate);
    font-size: 1.125rem;
  }
</style>
