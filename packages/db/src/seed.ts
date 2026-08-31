import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { adminUsers, auditLog, categories, divisions, products } from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

// Matches apps/api/src/middleware/auth.ts — do not drift.
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LENGTH = 64;
const PBKDF2_DIGEST = 'sha512';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST);
  return `${salt}:${hash.toString('hex')}`;
}

const seedData = {
  divisions: [
    { code: 'fiberglass', nameTh: 'ไฟเบอร์กลาส', nameEn: 'Fiberglass', sortOrder: 1 },
    {
      code: 'needlework',
      nameTh: 'เย็บปักถักร้อย',
      nameEn: 'Needlework & Embroidery',
      sortOrder: 2,
    },
    { code: 'florals', nameTh: 'ดอกไม้ประดิษฐ์', nameEn: 'Artificial Flowers', sortOrder: 3 },
  ],
  categories: [
    {
      divisionCode: 'fiberglass',
      slugTh: 'fiberglass-products',
      slugEn: 'fiberglass-products',
      nameTh: 'ผลิตภัณฑ์ไฟเบอร์กลาส',
      nameEn: 'Fiberglass Products',
    },
    {
      divisionCode: 'fiberglass',
      slugTh: 'wood-products',
      slugEn: 'wood-products',
      nameTh: 'ผลิตภัณฑ์ไม้',
      nameEn: 'Wood Products',
    },
    {
      divisionCode: 'fiberglass',
      slugTh: 'resin-products',
      slugEn: 'resin-products',
      nameTh: 'ผลิตภัณฑ์เรซิ่น',
      nameEn: 'Resin Products',
    },
    {
      divisionCode: 'needlework',
      slugTh: 'embroidered-shirts',
      slugEn: 'embroidered-shirts',
      nameTh: 'เสื้อเย็บปักลาย',
      nameEn: 'Embroidered Shirts',
    },
    {
      divisionCode: 'florals',
      slugTh: 'memorial-wreaths',
      slugEn: 'memorial-wreaths',
      nameTh: 'พวงมาลา',
      nameEn: 'Memorial Wreaths',
    },
    {
      divisionCode: 'florals',
      slugTh: 'funeral-wreaths',
      slugEn: 'funeral-wreaths',
      nameTh: 'พวงหรีด',
      nameEn: 'Funeral Wreaths',
    },
  ],
  // A minimum publishable catalogue so the storefront (and its Playwright run)
  // has real rows: one cart product per division plus an enquiry-only floral.
  products: [
    {
      categorySlugTh: 'fiberglass-products',
      sku: 'FG-0001',
      slugTh: 'fiberglass-planter-large',
      slugEn: 'fiberglass-planter-large',
      lotCode: 'LOT-FG-2408',
      purchaseMode: 'cart',
      nameTh: 'กระถางไฟเบอร์กลาส ขนาดใหญ่',
      nameEn: 'Large Fiberglass Planter',
      bodyTh: 'กระถางไฟเบอร์กลาสขึ้นรูปด้วยมือ ผิวเรียบ ทนแดดทนฝน เหมาะกับงานภูมิทัศน์',
      bodyEn: 'Hand-laid fiberglass planter with a smooth weatherproof finish for landscape work.',
      materialTh: 'ไฟเบอร์กลาส เรซิ่น',
      materialEn: 'Fiberglass, resin',
      finishNoteTh: 'ขัดและพ่นด้วยมือทีละใบ',
      finishNoteEn: 'Hand-sanded and sprayed one at a time',
      priceSatang: 285000,
    },
    {
      categorySlugTh: 'wood-products',
      sku: 'WD-0001',
      slugTh: 'teak-serving-tray',
      slugEn: 'teak-serving-tray',
      lotCode: 'LOT-WD-2408',
      purchaseMode: 'cart',
      nameTh: 'ถาดไม้สักเสิร์ฟ',
      nameEn: 'Teak Serving Tray',
      bodyTh: 'ถาดไม้สักแท้ เข้าลิ้นด้วยมือ เคลือบน้ำมันธรรมชาติ',
      bodyEn: 'Solid teak tray, hand-jointed and finished with natural oil.',
      materialTh: 'ไม้สักแท้',
      materialEn: 'Solid teak',
      finishNoteTh: 'ลงน้ำมันด้วยมือสามรอบ',
      finishNoteEn: 'Three hand-rubbed oil coats',
      priceSatang: 149000,
    },
    {
      categorySlugTh: 'embroidered-shirts',
      sku: 'NW-0001',
      slugTh: 'embroidered-cotton-shirt',
      slugEn: 'embroidered-cotton-shirt',
      lotCode: 'LOT-NW-2408',
      purchaseMode: 'cart',
      nameTh: 'เสื้อผ้าฝ้ายปักมือ',
      nameEn: 'Hand-Embroidered Cotton Shirt',
      bodyTh: 'เสื้อผ้าฝ้ายทอมือ ปักลายด้วยมือทีละตัวโดยช่างของศูนย์',
      bodyEn: 'Handwoven cotton shirt, embroidered one at a time by the centre artisans.',
      materialTh: 'ผ้าฝ้ายทอมือ',
      materialEn: 'Handwoven cotton',
      finishNoteTh: 'ปักมือประมาณ 12 ชั่วโมงต่อตัว',
      finishNoteEn: 'About 12 hours of hand embroidery per shirt',
      priceSatang: 195000,
    },
    {
      categorySlugTh: 'funeral-wreaths',
      sku: 'FL-0001',
      slugTh: 'funeral-wreath-standing',
      slugEn: 'funeral-wreath-standing',
      lotCode: 'LOT-FL-2408',
      purchaseMode: 'enquiry',
      nameTh: 'พวงหรีดตั้งพื้น',
      nameEn: 'Standing Funeral Wreath',
      bodyTh:
        'พวงหรีดดอกไม้ประดิษฐ์ตั้งพื้น จัดตามวันและสถานที่ที่แจ้ง พร้อมข้อความบนริบบิ้นตามต้องการ',
      bodyEn:
        'Standing wreath in artificial flowers, arranged for the date and venue you provide, with ribbon text as requested.',
      materialTh: 'ดอกไม้ประดิษฐ์ โครงหวาย',
      materialEn: 'Artificial flowers, rattan frame',
      finishNoteTh: 'จัดด้วยมือตามคำสั่งแต่ละงาน',
      finishNoteEn: 'Hand-arranged per order',
      priceSatang: null,
    },
  ],
} as const;

// Non-negotiable #9: a mutating action here is logged to audit_log.
// Creates the bootstrap superadmin from ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD.
// Refuses to touch an existing admin of the same email so a rotated password is never clobbered.
export async function setupBootstrapSuperadmin(db: ReturnType<typeof drizzle>): Promise<{
  created: boolean;
  reason?: string;
  adminId?: string;
}> {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) {
    return { created: false, reason: 'ADMIN_BOOTSTRAP_* not set' };
  }
  const existing = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);
  if (existing.length > 0) {
    return { created: false, reason: 'already exists — refusing to clobber a rotated admin' };
  }
  const now = Math.floor(Date.now() / 1000);
  const [row] = await db
    .insert(adminUsers)
    .values({
      email,
      passwordHash: hashPassword(password),
      displayName: 'ผู้ดูแลระบบ',
      role: 'superadmin',
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: adminUsers.id });
  await db.insert(auditLog).values({
    action: 'bootstrap.superadmin_create',
    severity: 'normal',
    entityType: 'admin_users',
    entityId: row.id,
    afterState: { email, role: 'superadmin', source: 'seed' },
    createdAt: now,
  });
  return { created: true, adminId: row.id };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  let admin: Awaited<ReturnType<typeof setupBootstrapSuperadmin>> | undefined;
  try {
    await db.transaction(async (tx) => {
      for (const d of seedData.divisions) {
        await tx
          .insert(divisions)
          .values(d)
          .onConflictDoUpdate({
            target: divisions.code,
            set: { nameTh: d.nameTh, nameEn: d.nameEn, sortOrder: d.sortOrder },
          });
      }
      let sort = 1;
      for (const c of seedData.categories) {
        const sortOrder = sort++;
        await tx
          .insert(categories)
          .values({ ...c, sortOrder })
          .onConflictDoUpdate({
            target: [categories.slugTh],
            set: {
              divisionCode: c.divisionCode,
              slugEn: c.slugEn,
              nameTh: c.nameTh,
              nameEn: c.nameEn,
              sortOrder,
            },
          });
      }
      const now = Math.floor(Date.now() / 1000);
      let productSort = 1;
      for (const { categorySlugTh, ...row } of seedData.products) {
        const [cat] = await tx
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.slugTh, categorySlugTh))
          .limit(1);
        if (!cat) throw new Error(`seed: category ${categorySlugTh} missing`);

        const sortOrder = productSort++;
        const values = {
          ...row,
          categoryId: cat.id,
          status: 'published',
          publishedAt: now,
          sortOrder,
        };
        await tx
          .insert(products)
          .values(values)
          .onConflictDoUpdate({ target: [products.sku], set: values });
      }
    });
    // Superadmin bootstrap runs after the catalogue tx (its own writes + audit row).
    admin = await setupBootstrapSuperadmin(db);
    process.stdout.write(
      JSON.stringify({
        level: 'info',
        msg: 'seed_done',
        divisions: seedData.divisions.length,
        categories: seedData.categories.length,
        products: seedData.products.length,
        admin: admin.created ? 'created' : admin.reason,
      }) + '\n',
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  process.stderr.write(
    JSON.stringify({ level: 'error', msg: 'seed_failed', error: String(err) }) + '\n',
  );
  process.exit(1);
});
