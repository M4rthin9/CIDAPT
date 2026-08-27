import { apiFetch } from '$lib/server/api';
import type { LayoutServerLoad } from './$types';

type Category = {
  slug: string;
  slug_th: string;
  slug_en: string;
  name_th: string;
  name_en: string;
};
type Division = { code: string; name_th: string; name_en: string };

export const load: LayoutServerLoad = async (event) => {
  const { lang, division } = event.params;

  let categories: Category[] = [];
  let divisionInfo: Division = { code: division, name_th: division, name_en: division };

  try {
    const res = await apiFetch(event, `/api/v1/catalog/divisions/${division}/categories`);
    if (res.ok) {
      const json = (await res.json()) as { data?: Category[]; meta?: { division?: Division } };
      categories = json.data ?? [];
      divisionInfo = json.meta?.division ?? divisionInfo;
    }
  } catch {
    // API not available — render empty state
  }

  return { lang, division, categories, divisionInfo };
};
