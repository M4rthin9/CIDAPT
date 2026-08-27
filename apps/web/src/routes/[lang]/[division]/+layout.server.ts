import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, fetch }) => {
  const { lang, division } = params;

  // Fetch categories from API
  let categories: { slug: string; name_th: string; name_en: string }[] = [];
  try {
    const res = await fetch(
      `http://localhost:3000/api/v1/catalog/divisions/${division}/categories`,
    );
    if (res.ok) {
      const json = await res.json();
      categories = json.data ?? [];
    }
  } catch {
    // API not available — render empty state
  }

  return { lang, division, categories };
};
