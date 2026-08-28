<script lang="ts">
  import { t } from '$lib/i18n.svelte';
</script>

<div class="nf">
  <h1>404</h1>
  <p class="muted">{t('ไม่พบหน้านี้', 'Page not found')}</p>
  <a href="#/dashboard">{t('กลับไปแดชบอร์ด', 'Back to dashboard')}</a>
</div>

<style>
  .nf {
    padding: 4rem 2rem;
    text-align: center;
  }
  h1 {
    font-size: 3rem;
    margin-bottom: 0.5rem;
  }
  p {
    margin-bottom: 1rem;
  }
</style>
