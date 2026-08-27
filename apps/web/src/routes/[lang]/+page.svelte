<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const t = $derived(
    data.lang === 'th'
      ? {
          hero_title: 'งานฝีมือจากทัณฑสถาน',
          hero_sub: 'ผลิตภัณฑ์แฮนด์เมดจากฝ่ายฝึกวิชาชีพผู้ต้องขัง',
          hero_cta: 'เลือกชมสินค้า',
          divisions_title: 'กองงานของเรา',
          divisions: [
            {
              slug: 'fiberglass',
              name: 'ไฟเบอร์กลาส',
              desc: 'ผลิตภัณฑ์ไฟเบอร์กลาส ไม้ และเรซิ่น',
              img: '/images/fiberglass.jpg',
            },
            {
              slug: 'needlework',
              name: 'เย็บปักถักร้อย',
              desc: 'เสื้อเย็บปักลาย เครื่องแต่งกาย',
              img: '/images/needlework.jpg',
            },
            {
              slug: 'florals',
              name: 'ดอกไม้ประดิษฐ์',
              desc: 'พวงมาลา พวงหรีด สำหรับงานพิธี',
              img: '/images/florals.jpg',
            },
          ],
          about_title: 'เกี่ยวกับเรา',
          about_text:
            'ฝ่ายฝึกวิชาชีพผู้ต้องขัง ส่วนพัฒนาผู้ต้องขัง ทัณฑสถานบำบัดพิเศษกลาง เป็นหน่วยงานในสังกัดกรมราชทัณฑ์ ที่ให้การฝึกวิชาชีพแก่ผู้ต้องขังเพื่อพัฒนาทักษะและสร้างรายได้',
        }
      : {
          hero_title: 'Handcraft from Corrections',
          hero_sub: 'Handmade products from the Vocational Training Division',
          hero_cta: 'Browse Products',
          divisions_title: 'Our Workshops',
          divisions: [
            {
              slug: 'fiberglass',
              name: 'Fiberglass',
              desc: 'Fiberglass, wood, and resin products',
              img: '/images/fiberglass.jpg',
            },
            {
              slug: 'needlework',
              name: 'Needlework',
              desc: 'Embroidered shirts and apparel',
              img: '/images/needlework.jpg',
            },
            {
              slug: 'florals',
              name: 'Artificial Flowers',
              desc: 'Memorial and funeral wreaths',
              img: '/images/florals.jpg',
            },
          ],
          about_title: 'About Us',
          about_text:
            'The Vocational Training Division of the Special Central Correctional Institution, under the Department of Corrections, provides vocational training to inmates for skill development and income generation.',
        },
  );
</script>

<svelte:head>
  <title
    >{data.lang === 'th'
      ? 'CIDA Craft — งานฝีมือจากทัณฑสถาน'
      : 'CIDA Craft — Handcraft from Corrections'}</title
  >
  <meta name="description" content={t.hero_sub} />
</svelte:head>

<!-- Hero -->
<section class="hero">
  <div class="hero-inner container">
    <h1 class="hero-title reveal">{t.hero_title}</h1>
    <p class="hero-sub reveal reveal-delay-1">{t.hero_sub}</p>
    <a href="/{data.lang}/fiberglass" class="hero-cta reveal reveal-delay-2">{t.hero_cta}</a>
  </div>
</section>

<!-- Divisions -->
<section class="divisions">
  <div class="container">
    <h2 class="section-title reveal">{t.divisions_title}</h2>

    <div class="division-grid">
      {#each t.divisions as div, i}
        <a href="/{data.lang}/{div.slug}" class="division-card reveal reveal-delay-{i + 1}">
          <div class="division-img-wrap">
            <div class="division-img-placeholder"></div>
          </div>
          <div class="division-info">
            <h3 class="division-name">{div.name}</h3>
            <p class="division-desc">{div.desc}</p>
          </div>
        </a>
      {/each}
    </div>
  </div>
</section>

<!-- About -->
<section class="about">
  <div class="container">
    <h2 class="section-title reveal">{t.about_title}</h2>
    <p class="about-text reveal reveal-delay-1">{t.about_text}</p>
  </div>
</section>

<style>
  /* Hero */
  .hero {
    padding: var(--space-4xl) 0;
    background-color: var(--mist);
    text-align: center;
  }

  .hero-inner {
    max-width: 800px;
  }

  .hero-title {
    font-family: var(--font-display);
    font-size: clamp(2.5rem, 6vw, 4rem);
    font-weight: 700;
    letter-spacing: -0.025em;
    line-height: 1.1;
    color: var(--ink);
    margin-bottom: var(--space-lg);
  }

  .hero-sub {
    font-size: clamp(1rem, 2vw, 1.25rem);
    color: var(--slate);
    margin-bottom: var(--space-xl);
    line-height: 1.75;
  }

  .hero-cta {
    display: inline-block;
    padding: var(--space-md) var(--space-xl);
    background-color: var(--marigold);
    color: var(--paper);
    font-weight: 600;
    border-radius: 8px;
    text-decoration: none;
    transition: opacity var(--duration-fast) ease;
  }

  .hero-cta:hover {
    opacity: 0.85;
    text-decoration: none;
  }

  /* Divisions */
  .divisions {
    padding: var(--space-4xl) 0;
  }

  .section-title {
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 700;
    letter-spacing: -0.025em;
    text-align: center;
    margin-bottom: var(--space-3xl);
    color: var(--ink);
  }

  .division-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--space-xl);
  }

  .division-card {
    display: block;
    text-decoration: none;
    color: inherit;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition:
      box-shadow var(--duration-fast) ease,
      transform var(--duration-fast) ease;
  }

  .division-card:hover {
    box-shadow: var(--shadow-lg);
    transform: translateY(-2px);
    text-decoration: none;
  }

  .division-img-wrap {
    aspect-ratio: 4/3;
    background-color: var(--mist);
    overflow: hidden;
  }

  .division-img-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, var(--mist) 0%, var(--line) 100%);
  }

  .division-info {
    padding: var(--space-lg);
  }

  .division-name {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: var(--space-sm);
    color: var(--ink);
  }

  .division-desc {
    font-size: 0.875rem;
    color: var(--slate);
    line-height: 1.75;
  }

  /* About */
  .about {
    padding: var(--space-4xl) 0;
    background-color: var(--mist);
    text-align: center;
  }

  .about-text {
    max-width: 700px;
    margin: 0 auto;
    font-size: 1rem;
    color: var(--slate);
    line-height: 1.75;
  }
</style>
