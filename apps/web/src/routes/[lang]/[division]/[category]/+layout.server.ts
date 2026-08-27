import { apiFetch } from '$lib/server/api';
import type { LayoutServerLoad } from './$types';

type Category = {
  slug: string;
  slug_th: string;
  slug_en: string;
  name_th: string;
  name_en: string;
};
type ProductCard = {
  id: string;
  slug: string;
  slug_th: string;
  slug_en: string;
  name_th: string;
  name_en: string;
  purchaseMode: string;
  priceFormatted: string;
};

export const load: LayoutServerLoad = async (event) => {
  const { lang, division, category } = event.params;
  const parentData = await event.parent();

  let categoryData: Category | null = null;
  let products: ProductCard[] = [];

  try {
    const res = await apiFetch(
      event,
      `/api/v1/catalog/divisions/${division}/categories/${category}/products`,
    );
    if (res.ok) {
      const json = (await res.json()) as {
        data?: { category?: Category; products?: ProductCard[] };
      };
      categoryData = json.data?.category ?? null;
      products = json.data?.products ?? [];
    }
  } catch {
    // API not available
  }

  const fallback = parentData.categories?.find(
    (c) => c.slug_th === category || c.slug_en === category,
  );

  return {
    lang,
    division,
    categorySlug: category,
    category: categoryData ??
      fallback ?? {
        slug: category,
        slug_th: category,
        slug_en: category,
        name_th: category,
        name_en: category,
      },
    divisionName_th: parentData.divisionInfo.name_th,
    divisionName_en: parentData.divisionInfo.name_en,
    products,
  };
};
