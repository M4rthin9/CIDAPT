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
    }
  } catch {
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
