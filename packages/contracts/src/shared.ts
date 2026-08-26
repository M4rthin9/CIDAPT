import { z } from 'zod';

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const THAI_PHONE_RE = /^0\d{8,9}$/;
export const POSTCODE_RE = /^\d{5}$/;
export const ORDER_NO_RE = /^CIDA-\d{4}-\d{5}$/;
export const SETTING_KEY_RE = /^[a-z][a-z0-9_.]{0,63}$/;

export const idSchema = z.uuid();
export const slugSchema = z.string().regex(SLUG_RE);
export const phoneSchema = z.string().regex(THAI_PHONE_RE);
export const postcodeSchema = z.string().regex(POSTCODE_RE);
export const orderNoSchema = z.string().regex(ORDER_NO_RE);

export const satangSchema = z.number().int();
export const nonnegSatangSchema = z.number().int().nonnegative();
export const unixSecondsSchema = z.number().int().nonnegative();

export const localeSchema = z.enum(['th', 'en']);
