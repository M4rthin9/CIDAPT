import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, fetch, parent }) => {
  const { lang, division, category, slug } = params;
  const parentData = await parent();

  let product: {
    id: string;
    name_th: string;
    name_en: string;
    description_th: string;
    description_en: string;
    priceFormatted: string;
    purchaseMode: string;
    lotCode?: string;
    material?: string;
    handFinish?: string;
    slug: string;
  } | null = null;

  try {
    const res = await fetch(`http://localhost:3000/api/v1/catalog/products/${slug}`);
    if (res.ok) {
      const json = await res.json();
      product = json.data ?? null;
    } else if (res.status === 404) {
      // Check for redirect
      const redirectPath = `/${lang}/${division}/${category}/${slug}`;
      try {
        const redirRes = await fetch(
          `http://localhost:3000/api/v1/redirects/${encodeURIComponent(redirectPath.slice(1))}`,
        );
        if (redirRes.ok) {
          const redirJson = await redirRes.json();
          const to = redirJson.data?.to;
          if (to) {
            throw redirect(301, to);
          }
        }
      } catch (e) {
        // If it's a SvelteKit redirect, rethrow it
        if (e && typeof e === 'object' && 'status' in e) throw e;
        // Otherwise, product not found — continue to render 404 state
      }
    }
  } catch (e) {
    // If it's a SvelteKit redirect, rethrow it
    if (e && typeof e === 'object' && 'status' in e) throw e;
    // API not available
  }

  return {
    lang,
    division,
    categorySlug: category,
    product,
    categories: parentData.categories,
  };
};
