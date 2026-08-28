<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '$lib/i18n.svelte';

  interface Props {
    title: string;
    subtitle?: string;
    /** Buttons rendered on the right of the header. */
    actions?: Snippet;
    loading?: boolean;
    error?: string;
    notice?: string;
    children: Snippet;
  }

  const {
    title,
    subtitle = '',
    actions,
    loading = false,
    error = '',
    notice = '',
    children,
  }: Props = $props();
</script>

<div class="screen">
  <div class="screen-head">
    <div>
      <h1>{title}</h1>
      {#if subtitle}<p>{subtitle}</p>{/if}
    </div>
    {#if actions}
      <div class="toolbar">{@render actions()}</div>
    {/if}
  </div>

  {#if error}
    <div class="banner banner-error" role="alert">{error}</div>
  {/if}
  {#if notice}
    <div class="banner banner-ok" role="status" aria-live="polite">{notice}</div>
  {/if}

  {#if loading}
    <p class="muted" role="status" aria-live="polite">{t('กำลังโหลด...', 'Loading...')}</p>
  {:else}
    {@render children()}
  {/if}
</div>
