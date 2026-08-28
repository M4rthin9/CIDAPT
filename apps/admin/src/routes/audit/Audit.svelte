<script lang="ts">
  import { api, ApiRequestError } from '$lib/api';
  import { lang, t, formatDate } from '$lib/i18n.svelte';
  import Screen from '$lib/ui/Screen.svelte';
  import Modal from '$lib/ui/Modal.svelte';

  interface AuditRow {
    id: string;
    actorAdminId: string | null;
    action: string;
    severity: string;
    entityType: string;
    entityId: string | null;
    beforeState: unknown;
    afterState: unknown;
    requestId: string | null;
    ip: string | null;
    createdAt: number;
  }

  let rows = $state<AuditRow[]>([]);
  let loading = $state(true);
  let error = $state('');

  let filterEntityType = $state('');
  let filterAction = $state('');
  let filterSeverity = $state('');

  let inspecting = $state<AuditRow | null>(null);

  async function load() {
    loading = true;
    error = '';
    try {
      const qs = new URLSearchParams();
      if (filterEntityType) qs.set('entityType', filterEntityType);
      if (filterAction) qs.set('action', filterAction);
      if (filterSeverity) qs.set('severity', filterSeverity);
      rows = await api<AuditRow[]>(`/admin/audit${qs.toString() ? `?${qs}` : ''}`);
    } catch (err) {
      error =
        err instanceof ApiRequestError
          ? lang.pick(err.message_th, err.message_en)
          : t('โหลดบันทึกไม่สำเร็จ', 'Could not load audit log');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });

  const pretty = (v: unknown) => (v === null || v === undefined ? '—' : JSON.stringify(v, null, 2));
</script>

<Screen
  title={t('บันทึกตรวจสอบ', 'Audit log')}
  subtitle={t(
    'ทุกการกระทำที่เปลี่ยนแปลงข้อมูลถูกบันทึกไว้ที่นี่',
    'Every mutating action in the system is recorded here',
  )}
  {loading}
  {error}
>
  {#snippet actions()}
    <!-- Full-page navigation so the browser handles the CSV download. -->
    <a class="btn" href="/api/v1/admin/audit/export" download>{t('ส่งออก CSV', 'Export CSV')}</a>
  {/snippet}

  <div class="toolbar">
    <label class="field inline">
      {t('ชนิดข้อมูล', 'Entity type')}
      <input type="text" bind:value={filterEntityType} placeholder="order, product, ..." />
    </label>
    <label class="field inline">
      {t('การกระทำ', 'Action')}
      <input type="text" bind:value={filterAction} placeholder="product.publish" />
    </label>
    <label class="field inline">
      {t('ระดับ', 'Severity')}
      <select bind:value={filterSeverity}>
        <option value="">{t('ทั้งหมด', 'All')}</option>
        <option value="normal">normal</option>
        <option value="red">red</option>
      </select>
    </label>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>{t('เมื่อ', 'When')}</th>
          <th>{t('การกระทำ', 'Action')}</th>
          <th>{t('ชนิดข้อมูล', 'Entity')}</th>
          <th>{t('ระดับ', 'Severity')}</th>
          <th>IP</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.id)}
          <tr class:red={row.severity === 'red'}>
            <td>{formatDate(row.createdAt)}</td>
            <td class="num">{row.action}</td>
            <td>
              {row.entityType}
              {#if row.entityId}<br /><span class="muted num">{row.entityId}</span>{/if}
            </td>
            <td>{row.severity}</td>
            <td class="num">{row.ip ?? '—'}</td>
            <td>
              <button class="btn" onclick={() => (inspecting = row)}>{t('ดู', 'View')}</button>
            </td>
          </tr>
        {:else}
          <tr><td colspan="6" class="muted">{t('ไม่มีบันทึก', 'No entries')}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</Screen>

{#if inspecting}
  <Modal title={inspecting.action} onclose={() => (inspecting = null)}>
    <dl class="meta">
      <dt>{t('เมื่อ', 'When')}</dt>
      <dd>{formatDate(inspecting.createdAt)}</dd>
      <dt>{t('ผู้กระทำ', 'Actor')}</dt>
      <dd class="num">{inspecting.actorAdminId ?? '—'}</dd>
      <dt>{t('ชนิดข้อมูล', 'Entity')}</dt>
      <dd class="num">{inspecting.entityType} {inspecting.entityId ?? ''}</dd>
      <dt>Request ID</dt>
      <dd class="num">{inspecting.requestId ?? '—'}</dd>
    </dl>

    <h3>{t('ก่อน', 'Before')}</h3>
    <pre>{pretty(inspecting.beforeState)}</pre>
    <h3>{t('หลัง', 'After')}</h3>
    <pre>{pretty(inspecting.afterState)}</pre>
  </Modal>
{/if}

<style>
  .field.inline {
    margin-bottom: 0;
  }
  tr.red td {
    background: rgba(179, 38, 30, 0.05);
  }
  .meta {
    display: grid;
    grid-template-columns: minmax(110px, auto) 1fr;
    gap: 0.25rem var(--space-md);
    margin: 0 0 var(--space-md);
    font-size: 0.875rem;
  }
  dt {
    color: var(--slate);
  }
  dd {
    margin: 0;
  }
  h3 {
    font-size: 0.875rem;
    margin-top: var(--space-md);
  }
  pre {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    background: var(--mist);
    border-radius: 6px;
    padding: 0.75rem;
    overflow-x: auto;
    max-height: 16rem;
    margin: 0;
  }
</style>
