import { apiData } from '$lib/server/api';
import type { LayoutServerLoad } from './$types';

type Cart = { items: { productId: string; quantity: number }[] };

export const load: LayoutServerLoad = async (event) => {
  const cart = await apiData<Cart>(event, '/api/v1/cart');
  const items = (cart?.items ?? []).map((i) => ({
    productId: i.productId,
    quantity: i.quantity,
  }));

  return { lang: event.params.lang, items };
};
