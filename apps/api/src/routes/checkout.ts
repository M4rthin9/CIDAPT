import { Hono } from 'hono';
import { inArray } from 'drizzle-orm';
import { db } from '../db';
import { orders, orderItems } from '@cida/db/schema';
import { products } from '@cida/db/schema';
import { writeAuditLog } from '../middleware/audit';
import { AppError } from '../errors';
import { checkoutSchema } from '@cida/contracts';
import { nextOrderNo } from '../lib/order-no';

const checkout = new Hono();

checkout.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'ข้อมูลไม่ถูกต้อง',
      'Invalid input',
      422,
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    );
  }

  const { items, contactName, phone, email, shipping, shippingNote } = parsed.data;

  // Fetch all products in one query
  const productIds = items.map((i) => i.productId);
  const productRows = await db.instance
    .select()
    .from(products)
    .where(inArray(products.id, productIds));

  if (productRows.length !== productIds.length) {
    throw new AppError(
      'checkout_products_not_found',
      'ไม่พบสินค้าบางรายการ',
      'Some products not found',
      400,
    );
  }

  // Non-negotiable: reject enquiry products server-side (P5 scope)
  const enquiryProducts = productRows.filter((p) => p.purchaseMode === 'enquiry');
  if (enquiryProducts.length > 0) {
    throw new AppError(
      'checkout_enquiry_not_allowed',
      'สินค้าบางรายการต้องติดต่อเจ้าหน้าที่',
      'Some products require staff contact — not available for online checkout',
      400,
      { enquiryProductIds: enquiryProducts.map((p) => p.id) },
    );
  }

  // Build order items and calculate totals
  let subtotalSatang = 0;
  const orderItemsData = items.map((item) => {
    const product = productRows.find((p) => p.id === item.productId)!;
    const unitPrice = product.priceSatang!;
    const lineTotal = unitPrice * item.quantity;
    subtotalSatang += lineTotal;

    return {
      productId: product.id,
      sku: product.sku,
      nameTh: product.nameTh,
      nameEn: product.nameEn,
      unitPriceSatang: unitPrice,
      quantity: item.quantity,
      lineTotalSatang: lineTotal,
    };
  });

  const totalSatang = subtotalSatang;
  const orderNo = await nextOrderNo();
  const now = Math.floor(Date.now() / 1000);

  // Create order in transaction
  const order = await db.instance.transaction(async (tx) => {
    const [o] = await tx
      .insert(orders)
      .values({
        orderNo,
        status: 'pending_payment',
        contactName,
        phone,
        email: email ?? null,
        addrLine1: shipping.addrLine1,
        addrLine2: shipping.addrLine2 ?? null,
        subdistrict: shipping.subdistrict,
        district: shipping.district,
        province: shipping.province,
        postcode: shipping.postcode,
        shippingNote: shippingNote ?? null,
        subtotalSatang,
        discountSatang: 0,
        shippingSatang: 0,
        totalSatang,
        placedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!o) throw new AppError('checkout_failed', 'สร้างคำสั่งซื้อไม่สำเร็จ', 'Failed to create order', 500);

    await tx.insert(orderItems).values(
      orderItemsData.map((item) => ({
        orderId: o.id,
        ...item,
      })),
    );

    return o;
  });

  if (!order) {
    throw new AppError('checkout_failed', 'สร้างคำสั่งซื้อไม่สำเร็จ', 'Failed to create order', 500);
  }

  await writeAuditLog(c, {
    action: 'checkout.create',
    entityType: 'order',
    entityId: order.id,
    afterState: { orderNo, totalSatang, itemCount: items.length },
  });

  return c.json({
    data: {
      orderId: order.id,
      orderNo: order.orderNo,
      totalSatang: order.totalSatang,
      status: order.status,
    },
  });
});

export default checkout;
