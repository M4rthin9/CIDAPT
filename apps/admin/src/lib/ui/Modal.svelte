<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '$lib/i18n.svelte';

  interface Props {
    title: string;
    busy?: boolean;
    saveLabel?: string;
    onclose: () => void;
    onsave?: () => void;
    children: Snippet;
  }

  const { title, busy = false, saveLabel = '', onclose, onsave, children }: Props = $props();

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window {onkeydown} />

<!-- Backdrop click closes; the dialog stops propagation so inner clicks don't. -->
<div
  class="modal-backdrop"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) onclose();
  }}
>
  <div class="modal" role="dialog" aria-modal="true" aria-label={title}>
    <div class="modal-head">
      <h2>{title}</h2>
      <button class="btn" type="button" onclick={onclose} aria-label={t('ปิด', 'Close')}>×</button>
    </div>

    {@render children()}

    <div class="modal-foot">
      <button class="btn" type="button" onclick={onclose} disabled={busy}>
        {t('ยกเลิก', 'Cancel')}
      </button>
      {#if onsave}
        <button class="btn btn-primary" type="button" onclick={onsave} disabled={busy}>
          {busy ? t('กำลังบันทึก...', 'Saving...') : saveLabel || t('บันทึก', 'Save')}
        </button>
      {/if}
    </div>
  </div>
</div>
