import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, fetch, parent }) => {
  const { lang, division, category } = params;
  const parentData = await parent();

  // Fetch category + products from API
  let categoryData: { name_th: string; name_en: string } | null = null;
  let products: { slug: string; name_th: string; name_en: string; priceFormatted: string }[] = [];

  try {
    const res = await fetch(
      `http://localhost:3000/api/v1/catalog/divisions/${division}/categories/${category}/products`,
    );
    if (res.ok) {
      const json = await res.json();
      categoryData = json.data?.category ?? null;
      products = json.data?.products ?? [];
    }
  } catch {
    // API not available
  }

  // Find division name from parent
  const divCat = parentData.categories?.find((c: { slug: string }) => c.slug === category);

  return {
    lang,
    division,
    categorySlug: category,
    category: categoryData ?? divCat ?? { name_th: category, name_en: category },
    divisionName_th: division,
    divisionName_en: division,
    products,
  };
};
