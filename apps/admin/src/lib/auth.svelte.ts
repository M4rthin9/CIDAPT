import { api } from './api';
import { SESSION_KEY, clearSession } from './storage';

export type Role = 'superadmin' | 'admin' | 'officer';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

export const ROLE_ORDER: Record<Role, number> = {
  officer: 1,
  admin: 2,
  superadmin: 3,
};

export class Session {
  user = $state<SessionUser | null>(null);
  loaded = $state(false);

  constructor() {
    const cached = localStorage.getItem(SESSION_KEY);
    if (cached) {
      try {
        this.user = JSON.parse(cached) as SessionUser;
      } catch {
        clearSession();
      }
    }
  }

  get isAuthed() {
    return this.user !== null;
  }

  hasRole(minRole: Role): boolean {
    if (!this.user) return false;
    return ROLE_ORDER[this.user.role] >= ROLE_ORDER[minRole];
  }

  /** Re-validates the cookie against /auth/me and refreshes the cached user. */
  async refresh() {
    try {
      const me = await api<SessionUser>('/auth/me');
      this.user = me;
      localStorage.setItem(SESSION_KEY, JSON.stringify(me));
    } catch {
      this.user = null;
      clearSession();
    } finally {
      this.loaded = true;
    }
  }

  async login(email: string, password: string) {
    const me = await api<SessionUser>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      { redirectOn401: false },
    );
    this.user = me;
    localStorage.setItem(SESSION_KEY, JSON.stringify(me));
    return me;
  }

  async logout() {
    try {
      await api('/auth/logout', { method: 'POST' }, { redirectOn401: false });
    } finally {
      this.user = null;
      clearSession();
    }
  }
}

export const session = new Session();
