import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, request }) => {
  const lang = cookies.get('lang');
  if (lang === 'en') throw redirect(302, '/en');

  const accept = request.headers.get('accept-language') ?? '';
  const preferred = accept.includes('en') ? 'en' : 'th';

  throw redirect(302, `/${preferred}`);
};
