import {
  pgTable,
  text,
  boolean,
  integer,
  bigint,
  uuid,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import type { ExtraConfigColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createdAt, pk, unixSeconds, updatedAt } from './_shared';
import { adminUsers } from './admin';

const slugCheck = (col: ExtraConfigColumn) => sql`${col} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`;

export const pages = pgTable(
  'pages',
  {
    id: pk(),
    slugTh: text('slug_th').notNull(),
    slugEn: text('slug_en').notNull(),
    titleTh: text('title_th').notNull().default(''),
    titleEn: text('title_en').notNull().default(''),
    bodyTh: text('body_th'),
    bodyEn: text('body_en'),
    status: text('status').notNull().default('draft'),
    publishedAt: unixSeconds('published_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('pages_slug_th_key').on(t.slugTh),
    uniqueIndex('pages_slug_en_key').on(t.slugEn),
    check('pages_slug_th_format', slugCheck(t.slugTh)),
    check('pages_slug_en_format', slugCheck(t.slugEn)),
    check('pages_status_check', sql`${t.status} in ('draft', 'published')`),
    // Non-negotiable #12: both languages or it doesn't publish.
    check(
      'pages_publish_completeness',
      sql`${t.status} <> 'published' or (${t.titleTh} <> '' and ${t.titleEn} <> '' and ${t.bodyTh} is not null and ${t.bodyEn} is not null)`,
    ),
  ],
);

export const newsPosts = pgTable(
  'news_posts',
  {
    id: pk(),
    slugTh: text('slug_th').notNull(),
    slugEn: text('slug_en').notNull(),
    titleTh: text('title_th').notNull().default(''),
    titleEn: text('title_en').notNull().default(''),
    excerptTh: text('excerpt_th'),
    excerptEn: text('excerpt_en'),
    bodyTh: text('body_th'),
    bodyEn: text('body_en'),
    heroImageKey: text('hero_image_key'),
    authorAdminId: uuid('author_admin_id').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    status: text('status').notNull().default('draft'),
    publishAt: unixSeconds('publish_at'),
    publishedAt: unixSeconds('published_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('news_posts_slug_th_key').on(t.slugTh),
    uniqueIndex('news_posts_slug_en_key').on(t.slugEn),
    index('news_posts_status_publish_idx').on(t.status, t.publishAt),
    check('news_posts_slug_th_format', slugCheck(t.slugTh)),
    check('news_posts_slug_en_format', slugCheck(t.slugEn)),
    check('news_posts_status_check', sql`${t.status} in ('draft', 'published')`),
    check(
      'news_posts_publish_completeness',
      sql`${t.status} <> 'published' or (${t.titleTh} <> '' and ${t.titleEn} <> '' and ${t.bodyTh} is not null and ${t.bodyEn} is not null)`,
    ),
  ],
);

export const events = pgTable(
  'events',
  {
    id: pk(),
    titleTh: text('title_th').notNull().default(''),
    titleEn: text('title_en').notNull().default(''),
    descriptionTh: text('description_th'),
    descriptionEn: text('description_en'),
    locationTh: text('location_th'),
    locationEn: text('location_en'),
    startsAt: bigint('starts_at', { mode: 'number' }).notNull(),
    endsAt: unixSeconds('ends_at'),
    heroImageKey: text('hero_image_key'),
    status: text('status').notNull().default('draft'),
    publishedAt: unixSeconds('published_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('events_starts_idx').on(t.startsAt),
    check('events_status_check', sql`${t.status} in ('draft', 'published')`),
    check('events_window_order', sql`${t.endsAt} is null or ${t.endsAt} >= ${t.startsAt}`),
    check(
      'events_publish_completeness',
      sql`${t.status} <> 'published' or (${t.titleTh} <> '' and ${t.titleEn} <> '' and ${t.descriptionTh} is not null and ${t.descriptionEn} is not null)`,
    ),
  ],
);

export const banners = pgTable(
  'banners',
  {
    id: pk(),
    placement: text('placement').notNull(),
    imageKey: text('image_key').notNull(),
    altTh: text('alt_th').notNull(),
    altEn: text('alt_en').notNull(),
    linkPathTh: text('link_path_th'),
    linkPathEn: text('link_path_en'),
    sortOrder: integer('sort_order').notNull().default(0),
    active: boolean('active').notNull().default(true),
    startsAt: unixSeconds('starts_at'),
    endsAt: unixSeconds('ends_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('banners_placement_sort_idx').on(t.placement, t.sortOrder),
    check('banners_placement_check', sql`${t.placement} in ('home_hero', 'home_promo')`),
    check(
      'banners_window_order',
      sql`${t.startsAt} is null or ${t.endsAt} is null or ${t.endsAt} >= ${t.startsAt}`,
    ),
  ],
);
