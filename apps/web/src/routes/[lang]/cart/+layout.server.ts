import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, fetch }) => {
  const { lang } = params;

  let cart = {
    items: [] as {
      productId: string;
      name_th: string;
      name_en: string;
      priceSatang: number;
      priceFormatted: string;
      quantity: number;
    }[],
  };

  try {
    const res = await fetch('http://localhost:3000/api/v1/cart');
    if (res.ok) {
      const json = await res.json();
      cart = json.data ?? cart;
    }
  } catch {
    // API not available
  }

  return { lang, cart };
};
