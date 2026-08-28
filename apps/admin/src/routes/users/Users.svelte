<script lang="ts">
  import { api, ApiRequestError } from '$lib/api';
  import { session } from '$lib/auth.svelte';
  import { lang, t, formatDate } from '$lib/i18n.svelte';
  import Screen from '$lib/ui/Screen.svelte';
  import Modal from '$lib/ui/Modal.svelte';

  type Role = 'superadmin' | 'admin' | 'officer';

  interface AdminUser {
    id: string;
    email: string;
    displayName: string;
    role: Role;
    active: boolean;
    lastLoginAt: number | null;
    createdAt: number;
  }

  const ROLES: Role[] = ['officer', 'admin', 'superadmin'];

  const ROLE_LABEL: Record<Role, [string, string]> = {
    officer: ['เจ้าหน้าที่', 'Officer'],
    admin: ['ผู้ดูแลระบบ', 'Admin'],
    superadmin: ['ผู้ดูแลระบบสูงสุด', 'Superadmin'],
  };

  const roleLabel = (r: Role) => lang.pick(ROLE_LABEL[r][0], ROLE_LABEL[r][1]);

  let users = $state<AdminUser[]>([]);
  let loading = $state(true);
  let error = $state('');
  let notice = $state('');
  let busy = $state(false);

  let creating = $state(false);
  let newEmail = $state('');
  let newName = $state('');
  let newPassword = $state('');
  let newRole = $state<Role>('officer');

  let editing = $state<AdminUser | null>(null);
  let editName = $state('');
  let editRole = $state<Role>('officer');
  let editActive = $state(true);

  let resetting = $state<AdminUser | null>(null);
  let resetPassword = $state('');

  function describe(err: unknown, fallbackTh: string, fallbackEn: string): string {
    return err instanceof ApiRequestError
      ? lang.pick(err.message_th, err.message_en)
      : t(fallbackTh, fallbackEn);
  }

  async function load() {
    loading = true;
    error = '';
    try {
      users = await api<AdminUser[]>('/admin/users');
    } catch (err) {
      error = describe(err, 'โหลดผู้ใช้ไม่สำเร็จ', 'Could not load users');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });

  function openCreate() {
    creating = true;
    newEmail = '';
    newName = '';
    newPassword = '';
    newRole = 'officer';
  }

  async function create() {
    busy = true;
    error = '';
    try {
      await api('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          displayName: newName.trim(),
          password: newPassword,
          role: newRole,
        }),
      });
      notice = t('สร้างผู้ใช้แล้ว', 'User created');
      creating = false;
      await load();
    } catch (err) {
      error = describe(err, 'สร้างผู้ใช้ไม่สำเร็จ', 'Could not create user');
    } finally {
      busy = false;
    }
  }

  function openEdit(u: AdminUser) {
    editing = u;
    editName = u.displayName;
    editRole = u.role;
    editActive = u.active;
  }

  async function saveEdit() {
    if (!editing) return;
    busy = true;
    error = '';
    try {
      await api(`/admin/users/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({ displayName: editName.trim(), role: editRole, active: editActive }),
      });
      notice = t('บันทึกผู้ใช้แล้ว', 'User saved');
      editing = null;
      await load();
    } catch (err) {
      // The API refuses to deactivate the last superadmin — show its message.
      error = describe(err, 'บันทึกผู้ใช้ไม่สำเร็จ', 'Could not save user');
    } finally {
      busy = false;
    }
  }

  function openReset(u: AdminUser) {
    resetting = u;
    resetPassword = '';
  }

  async function saveReset() {
    if (!resetting) return;
    busy = true;
    error = '';
    try {
      await api(`/admin/users/${resetting.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: resetPassword }),
      });
      notice = t('ตั้งรหัสผ่านใหม่แล้ว', 'Password reset');
      resetting = null;
    } catch (err) {
      error = describe(err, 'ตั้งรหัสผ่านไม่สำเร็จ', 'Could not reset password');
    } finally {
      busy = false;
    }
  }
</script>

<Screen
  title={t('ผู้ใช้ระบบ', 'Admin users')}
  subtitle={t(
    'สิทธิ์ถูกบังคับที่ฝั่งเซิร์ฟเวอร์ทุกปลายทาง',
    'Roles are enforced server-side on every endpoint',
  )}
  {loading}
  {error}
  {notice}
>
  {#snippet actions()}
    <button class="btn btn-primary" onclick={openCreate}>{t('เพิ่มผู้ใช้', 'New user')}</button>
  {/snippet}

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>{t('อีเมล', 'Email')}</th>
          <th>{t('ชื่อ', 'Name')}</th>
          <th>{t('บทบาท', 'Role')}</th>
          <th>{t('สถานะ', 'Status')}</th>
          <th>{t('เข้าล่าสุด', 'Last login')}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each users as u (u.id)}
          <tr>
            <td class="num">
              {u.email}
              {#if u.id === session.user?.id}
                <span class="badge">{t('คุณ', 'you')}</span>
              {/if}
            </td>
            <td>{u.displayName}</td>
            <td>{roleLabel(u.role)}</td>
            <td>
              <span class="badge badge-{u.active ? 'published' : 'archived'}">
                {u.active ? t('ใช้งาน', 'Active') : t('ปิด', 'Disabled')}
              </span>
            </td>
            <td>{formatDate(u.lastLoginAt)}</td>
            <td class="actions">
              <button class="btn" onclick={() => openEdit(u)}>{t('แก้ไข', 'Edit')}</button>
              <button class="btn" onclick={() => openReset(u)}>
                {t('ตั้งรหัสผ่าน', 'Reset password')}
              </button>
            </td>
          </tr>
        {:else}
          <tr><td colspan="6" class="muted">{t('ไม่มีผู้ใช้', 'No users')}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</Screen>

{#if creating}
  <Modal
    title={t('เพิ่มผู้ใช้', 'New user')}
    {busy}
    onclose={() => (creating = false)}
    onsave={create}
  >
    <label class="field">
      {t('อีเมล', 'Email')}
      <input type="email" bind:value={newEmail} autocomplete="off" />
    </label>
    <label class="field">
      {t('ชื่อที่แสดง', 'Display name')}
      <input type="text" bind:value={newName} />
    </label>
    <label class="field">
      {t('รหัสผ่าน (อย่างน้อย 10 ตัวอักษร)', 'Password (min 10 characters)')}
      <input type="password" bind:value={newPassword} autocomplete="new-password" />
    </label>
    <label class="field">
      {t('บทบาท', 'Role')}
      <select bind:value={newRole}>
        {#each ROLES as r (r)}
          <option value={r}>{roleLabel(r)}</option>
        {/each}
      </select>
    </label>
  </Modal>
{/if}

{#if editing}
  <Modal
    title={t(`แก้ไข ${editing.email}`, `Edit ${editing.email}`)}
    {busy}
    onclose={() => (editing = null)}
    onsave={saveEdit}
  >
    <label class="field">
      {t('ชื่อที่แสดง', 'Display name')}
      <input type="text" bind:value={editName} />
    </label>
    <label class="field">
      {t('บทบาท', 'Role')}
      <select bind:value={editRole}>
        {#each ROLES as r (r)}
          <option value={r}>{roleLabel(r)}</option>
        {/each}
      </select>
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={editActive} />
      {t('เปิดใช้งาน', 'Active')}
    </label>
  </Modal>
{/if}

{#if resetting}
  <Modal
    title={t(`ตั้งรหัสผ่านใหม่ — ${resetting.email}`, `Reset password — ${resetting.email}`)}
    {busy}
    onclose={() => (resetting = null)}
    onsave={saveReset}
  >
    <label class="field">
      {t('รหัสผ่านใหม่ (อย่างน้อย 10 ตัวอักษร)', 'New password (min 10 characters)')}
      <input type="password" bind:value={resetPassword} autocomplete="new-password" />
    </label>
  </Modal>
{/if}

<style>
  .actions {
    white-space: nowrap;
  }
  .actions .btn + .btn {
    margin-left: 0.25rem;
  }
</style>
