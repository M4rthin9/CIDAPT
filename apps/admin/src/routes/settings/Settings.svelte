<script lang="ts">
  import { api, ApiRequestError } from '$lib/api';
  import { lang, t, formatDate } from '$lib/i18n.svelte';
  import Screen from '$lib/ui/Screen.svelte';
  import Modal from '$lib/ui/Modal.svelte';

  interface Setting {
    key: string;
    value: unknown;
    valueType: string;
    description: string;
    updatedAt: number | null;
  }

  let settings = $state<Setting[]>([]);
  let loading = $state(true);
  let error = $state('');
  let notice = $state('');
  let busy = $state(false);

  let editing = $state<Setting | null>(null);
  let editValue = $state('');

  function describe(err: unknown, fallbackTh: string, fallbackEn: string): string {
    return err instanceof ApiRequestError
      ? lang.pick(err.message_th, err.message_en)
      : t(fallbackTh, fallbackEn);
  }

  async function load() {
    loading = true;
    error = '';
    try {
      settings = await api<Setting[]>('/settings');
    } catch (err) {
      error = describe(err, 'โหลดการตั้งค่าไม่สำเร็จ', 'Could not load settings');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });

  /** Values are stored as JSON; show them as editable JSON text. */
  const asText = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v, null, 2));

  function edit(s: Setting) {
    editing = s;
    editValue = asText(s.value);
  }

  async function save() {
    if (!editing) return;
    busy = true;
    error = '';

    // Non-string types must round-trip as real JSON, so parse before sending
    // and reject malformed input here rather than letting the API 422.
    let parsed: unknown = editValue;
    if (editing.valueType !== 'string') {
      try {
        parsed = JSON.parse(editValue);
      } catch {
        error = t('รูปแบบ JSON ไม่ถูกต้อง', 'Value is not valid JSON');
        busy = false;
        return;
      }
    }

    try {
      await api(`/settings/${encodeURIComponent(editing.key)}`, {
        method: 'PUT',
        // `description` is NOT NULL and required by settingsSetSchema — echo the
        // existing text back so an edit never blanks it.
        body: JSON.stringify({
          value: parsed,
          valueType: editing.valueType,
          description: editing.description,
        }),
      });
      notice = t('บันทึกการตั้งค่าแล้ว', 'Setting saved');
      editing = null;
      await load();
    } catch (err) {
      error = describe(err, 'บันทึกการตั้งค่าไม่สำเร็จ', 'Could not save setting');
    } finally {
      busy = false;
    }
  }
</script>

<Screen
  title={t('ตั้งค่าระบบ', 'Settings')}
  subtitle={t(
    'ทะเบียนค่าตั้งของระบบ — เฉพาะผู้ดูแลระบบสูงสุด',
    'System settings registry — superadmin only',
  )}
  {loading}
  {error}
  {notice}
>
  {#if settings.length === 0}
    <p class="muted">{t('ยังไม่มีค่าตั้ง', 'No settings registered')}</p>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t('คีย์', 'Key')}</th>
            <th>{t('ค่า', 'Value')}</th>
            <th>{t('ชนิด', 'Type')}</th>
            <th>{t('แก้ไขล่าสุด', 'Updated')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each settings as s (s.key)}
            <tr>
              <td class="num">{s.key}</td>
              <td>
                <code>{asText(s.value)}</code>
                {#if s.description}<br /><span class="muted">{s.description}</span>{/if}
              </td>
              <td>{s.valueType}</td>
              <td>{formatDate(s.updatedAt)}</td>
              <td><button class="btn" onclick={() => edit(s)}>{t('แก้ไข', 'Edit')}</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Screen>

{#if editing}
  <Modal
    title={t(`แก้ไข ${editing.key}`, `Edit ${editing.key}`)}
    {busy}
    onclose={() => (editing = null)}
    onsave={save}
  >
    {#if editing.description}
      <p class="muted">{editing.description}</p>
    {/if}
    <label class="field">
      {editing.valueType === 'string' ? t('ค่า', 'Value') : t('ค่า (JSON)', 'Value (JSON)')}
      <textarea bind:value={editValue} spellcheck="false"></textarea>
    </label>
  </Modal>
{/if}

<style>
  code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    white-space: pre-wrap;
    word-break: break-word;
  }
  textarea {
    font-family: var(--font-mono);
  }
</style>
