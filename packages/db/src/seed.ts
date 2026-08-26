import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { categories, divisions } from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
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
} as const;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
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
    });
    process.stdout.write(
      JSON.stringify({
        level: 'info',
        msg: 'seed_done',
        divisions: seedData.divisions.length,
        categories: seedData.categories.length,
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
