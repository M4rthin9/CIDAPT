import { redirect, isRedirect } from '@sveltejs/kit';
import { apiFetch } from '$lib/server/api';
import type { LayoutServerLoad } from './$types';

type Product = {
  id: string;
  slug: string;
  slug_th: string;
  slug_en: string;
  lotCode: string;
  purchaseMode: string;
  name_th: string;
  name_en: string;
  description_th: string;
  description_en: string;
  material_th: string;
  material_en: string;
  handFinish_th: string;
  handFinish_en: string;
  priceFormatted: string;
};

export const load: LayoutServerLoad = async (event) => {
  const { lang, division, category, slug } = event.params;
  const parentData = await event.parent();

  let product: Product | null = null;

  try {
    const res = await apiFetch(event, `/api/v1/catalog/products/${slug}`);
    if (res.ok) {
      const json = (await res.json()) as { data?: Product };
      product = json.data ?? null;
    } else if (res.status === 404) {
      // Slug may have changed — a redirects row keeps the old URL resolvable.
      const fromPath = `/${lang}/${division}/${category}/${slug}`;
      const redirRes = await apiFetch(
        event,
        `/api/v1/redirects/${encodeURIComponent(fromPath.slice(1))}`,
      );
      if (redirRes.ok) {
        const redirJson = (await redirRes.json()) as { data?: { to?: string } };
        if (redirJson.data?.to) redirect(301, redirJson.data.to);
      }
    }
  } catch (e) {
    if (isRedirect(e)) throw e;
    // API not available — render the not-found state
  }

  return {
    lang,
    division,
    categorySlug: category,
    categoryName: lang === 'th' ? parentData.category.name_th : parentData.category.name_en,
    divisionName: lang === 'th' ? parentData.divisionName_th : parentData.divisionName_en,
    product,
    categories: parentData.categories,
  };
};
