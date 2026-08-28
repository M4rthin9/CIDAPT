<script lang="ts">
  import { uploadImage, type UploadResult } from '$lib/api';
  import { lang, t } from '$lib/i18n.svelte';

  interface Props {
    label: string;
    value: string;
    onchange: (key: string) => void;
  }

  const { label, value, onchange }: Props = $props();

  let uploading = $state(false);
  let error = $state('');

  const previewUrl = $derived(value ? `/api/v1/admin/media/${encodeURIComponent(value)}` : '');

  let input: HTMLInputElement | undefined = $state();

  async function pick(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    target.value = '';
    if (!file) return;

    uploading = true;
    error = '';
    try {
      const result: UploadResult = await uploadImage(file);
      onchange(result.key);
    } catch (err) {
      error =
        err instanceof Error
          ? lang.pick((err as { message_th?: string }).message_th ?? '', err.message)
          : t('อัปโหลดไม่สำเร็จ', 'Upload failed');
    } finally {
      uploading = false;
    }
  }

  function clear() {
    onchange('');
  }
</script>

<div class="image-picker">
  <span class="image-label">{label}</span>

  {#if previewUrl}
    <div class="image-preview">
      <img src={previewUrl} alt={label} />
    </div>
  {/if}

  <div class="image-actions">
    <input
      bind:this={input}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      class="visually-hidden"
      aria-label={t('เลือกไฟล์รูปภาพ', 'Choose an image file')}
      onchange={pick}
    />
    <button class="btn" type="button" disabled={uploading} onclick={() => input?.click()}>
      {uploading ? t('กำลังอัปโหลด...', 'Uploading...') : t('อัปโหลดรูปภาพ', 'Upload image')}
    </button>
    {#if value}
      <button class="btn" type="button" onclick={clear}>{t('ล้างรูป', 'Remove')}</button>
    {/if}
  </div>

  {#if value}
    <code class="image-key">{value}</code>
  {/if}
  {#if error}
    <p class="field-error">{error}</p>
  {/if}
</div>

<style>
  .image-picker {
    margin: 0.75rem 0;
  }
  .image-label {
    display: block;
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 0.35rem;
  }
  .image-preview {
    max-width: 320px;
    margin-bottom: 0.5rem;
    border: 1px solid var(--line, #e2e0db);
    border-radius: 6px;
    overflow: hidden;
  }
  .image-preview img {
    display: block;
    width: 100%;
    height: auto;
  }
  .image-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .image-key {
    display: block;
    margin-top: 0.4rem;
    font-size: 0.75rem;
    word-break: break-all;
    opacity: 0.7;
  }
  .field-error {
    color: #c0392b;
    font-size: 0.8rem;
    margin-top: 0.35rem;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
