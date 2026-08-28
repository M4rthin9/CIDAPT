<script lang="ts">
  import { session } from '$lib/auth.svelte';
  import { navigate } from '$lib/router.svelte';
  import { lang, t } from '$lib/i18n.svelte';
  import { ApiRequestError } from '$lib/api';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let busy = $state(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    busy = true;
    try {
      await session.login(email.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      error =
        err instanceof ApiRequestError
          ? lang.pick(err.message_th, err.message_en)
          : t('เกิดข้อผิดพลาด กรุณาลองใหม่', 'An error occurred. Please try again.');
    } finally {
      busy = false;
    }
  }
</script>

<div class="login">
  <form class="login-card" onsubmit={submit}>
    <button type="button" class="btn lang-toggle" onclick={() => lang.toggle()}>
      {lang.value === 'th' ? 'EN' : 'TH'}
    </button>
    <h1>{t('เข้าสู่ระบบ', 'Sign in')}</h1>
    <p class="sub">{t('CIDA Craft — ระบบจัดการหลังบ้าน', 'CIDA Craft admin')}</p>

    {#if error}
      <div class="banner banner-error" role="alert" aria-live="polite">{error}</div>
    {/if}

    <label class="field">
      {t('อีเมล', 'Email')}
      <input id="email" type="email" bind:value={email} autocomplete="username" required />
    </label>
    <label class="field">
      {t('รหัสผ่าน', 'Password')}
      <input
        id="password"
        type="password"
        bind:value={password}
        autocomplete="current-password"
        required
      />
    </label>

    <button class="btn btn-primary submit" type="submit" disabled={busy}>
      {busy ? t('กำลังเข้า...', 'Signing in...') : t('เข้าสู่ระบบ', 'Sign in')}
    </button>
  </form>
</div>

<style>
  .login {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--mist);
    padding: var(--space-lg);
  }
  .login-card {
    width: 100%;
    max-width: 380px;
    background: var(--paper);
    border-radius: 12px;
    padding: 2rem;
    position: relative;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  }
  .lang-toggle {
    position: absolute;
    top: 1rem;
    right: 1rem;
  }
  .sub {
    color: var(--slate);
    margin-bottom: 1.5rem;
  }
  .submit {
    width: 100%;
    padding: 0.75rem;
    margin-top: 0.5rem;
  }
</style>
