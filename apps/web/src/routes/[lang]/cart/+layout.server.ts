import { apiData } from '$lib/server/api';
import type { LayoutServerLoad } from './$types';

type Cart = {
  items: {
    productId: string;
    slug: string;
    slug_th: string;
    slug_en: string;
    name_th: string;
    name_en: string;
    priceSatang: number;
    priceFormatted: string;
    quantity: number;
  }[];
};

export const load: LayoutServerLoad = async (event) => {
  const cart = (await apiData<Cart>(event, '/api/v1/cart')) ?? { items: [] };
  return { lang: event.params.lang, cart };
};
