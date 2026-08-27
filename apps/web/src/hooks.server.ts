import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const lang = event.cookies.get('lang') ?? 'th';
  event.locals.lang = lang === 'en' ? 'en' : 'th';

  const response = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%lang%', event.locals.lang),
  });

  return response;
};
