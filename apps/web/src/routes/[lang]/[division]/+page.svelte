<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const division = $derived(data.division);

  // Names come from the divisions table; the standfirst copy is storefront-only.
  const divisionDesc: Record<string, Record<string, string>> = {
    fiberglass: {
      th: 'ผลิตภัณฑ์ไฟเบอร์กลาส ไม้ และเรซิ่น',
      en: 'Fiberglass, wood, and resin products',
    },
    needlework: {
      th: 'เสื้อเย็บปักลาย เครื่องแต่งกาย',
      en: 'Embroidered shirts and apparel',
    },
    florals: {
      th: 'พวงมาลา พวงหรีด สำหรับงานพิธี',
      en: 'Memorial and funeral wreaths',
    },
  };

  const info = $derived({
    name: data.lang === 'th' ? data.divisionInfo.name_th : data.divisionInfo.name_en,
    desc: divisionDesc[division]?.[data.lang] ?? '',
  });
</script>

<svelte:head>
  <title>{info.name} — CIDA Craft</title>
  <meta name="description" content={info.desc} />
</svelte:head>

<section class="division-hero">
  <div class="container">
    <h1 class="division-title reveal">{info.name}</h1>
    <p class="division-desc reveal reveal-delay-1">{info.desc}</p>
  </div>
</section>

<section class="categories">
  <div class="container">
    {#if data.categories?.length}
      <div class="category-grid">
        {#each data.categories as cat, i}
          <a
            href="/{data.lang}/{division}/{data.lang === 'th' ? cat.slug_th : cat.slug_en}"
            class="category-card reveal reveal-delay-{(i % 3) + 1}"
          >
            <div class="category-img"></div>
            <h3 class="category-name">{data.lang === 'th' ? cat.name_th : cat.name_en}</h3>
          </a>
        {/each}
      </div>
    {:else}
      <p class="empty-state">
        {data.lang === 'th' ? 'ยังไม่มีสินค้าในหมวดนี้' : 'No products in this category yet'}
      </p>
    {/if}
  </div>
</section>

<style>
  .division-hero {
    padding: var(--space-4xl) 0 var(--space-2xl);
    background-color: var(--mist);
    text-align: center;
  }

  .division-title {
    font-family: var(--font-display);
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 700;
    letter-spacing: -0.025em;
    margin-bottom: var(--space-md);
  }

  .division-desc {
    font-size: 1.125rem;
    color: var(--slate);
    line-height: 1.75;
  }

  .categories {
    padding: var(--space-3xl) 0;
  }

  .category-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-xl);
  }

  .category-card {
    display: block;
    text-decoration: none;
    color: inherit;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: box-shadow var(--duration-fast) ease;
  }

  .category-card:hover {
    box-shadow: var(--shadow-md);
    text-decoration: none;
  }

  .category-img {
    aspect-ratio: 4/3;
    background: linear-gradient(135deg, var(--mist) 0%, var(--line) 100%);
  }

  .category-name {
    padding: var(--space-md) var(--space-lg);
    font-family: var(--font-display);
    font-size: 1.125rem;
    font-weight: 600;
  }

  .empty-state {
    text-align: center;
    padding: var(--space-4xl) 0;
    color: var(--slate);
    font-size: 1.125rem;
  }
</style>
