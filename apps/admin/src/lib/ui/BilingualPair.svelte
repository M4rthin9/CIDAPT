<script lang="ts">
  import { t } from '$lib/i18n.svelte';

  interface Props {
    legend: string;
    th: string;
    en: string;
    /** `textarea` for body copy, `input` for titles and short fields. */
    multiline?: boolean;
    /** Marks the pair as gating publish — both halves must be filled. */
    requiredToPublish?: boolean;
  }

  let {
    legend,
    th = $bindable(),
    en = $bindable(),
    multiline = false,
    requiredToPublish = false,
  }: Props = $props();

  // Mirrors the server-side gate in the upsert contracts: publishing with either
  // language empty is rejected by the API. Showing it here is a courtesy, not
  // the enforcement point.
  const missing = $derived(requiredToPublish && (th.trim() === '' || en.trim() === ''));
</script>

<fieldset class="bilingual">
  <legend class="bilingual-legend">
    {legend}
    {#if requiredToPublish}
      <span class="muted"
        >— {t('ต้องกรอกทั้งสองภาษาจึงจะเผยแพร่ได้', 'both languages required to publish')}</span
      >
    {/if}
  </legend>

  <label class="field">
    <span><span class="lang-tag">TH</span>{t('ภาษาไทย', 'Thai')}</span>
    {#if multiline}
      <textarea bind:value={th} lang="th"></textarea>
    {:else}
      <input type="text" bind:value={th} lang="th" />
    {/if}
  </label>

  <label class="field">
    <span><span class="lang-tag">EN</span>{t('ภาษาอังกฤษ', 'English')}</span>
    {#if multiline}
      <textarea bind:value={en} lang="en"></textarea>
    {:else}
      <input type="text" bind:value={en} lang="en" />
    {/if}
  </label>

  {#if missing}
    <p class="bilingual-legend muted" style="grid-column: 1 / -1;">
      {t('ยังไม่ครบทั้งสองภาษา — เผยแพร่ไม่ได้', 'Incomplete — cannot be published yet')}
    </p>
  {/if}
</fieldset>

<style>
  fieldset {
    border: none;
    border-left: 2px solid var(--line);
    min-width: 0;
  }
</style>
