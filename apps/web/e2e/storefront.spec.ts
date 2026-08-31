import { test, expect, type Page } from '@playwright/test';

const API = process.env.E2E_API_URL ?? 'http://localhost:3000';

// Seeded fixtures (packages/db/src/seed.ts).
const CART_PRODUCT = {
  division: 'fiberglass',
  category: 'fiberglass-products',
  slug: 'fiberglass-planter-large',
};
const ENQUIRY_PRODUCT = {
  division: 'florals',
  category: 'funeral-wreaths',
  slug: 'funeral-wreath-standing',
};

/**
 * Navigate and wait for hydration. Interactive assertions (add-to-cart, enquiry
 * submit) must not fire before Svelte has attached its handlers, or the click
 * falls through to a native form submit and the test flakes.
 */
async function gotoHydrated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

async function withLang(page: Page, lang: 'th' | 'en', path: string) {
  await page.context().addCookies([{ name: 'lang', value: lang, domain: 'localhost', path: '/' }]);
  await gotoHydrated(page, `/${lang}${path}`);
}

function pdpPath(p: { division: string; category: string; slug: string }) {
  return `/${p.division}/${p.category}/${p.slug}`;
}

// ============================================
// Acceptance: Playwright at 360px in both languages across nav/PDP/cart/checkout
// ============================================

for (const lang of ['th', 'en'] as const) {
  test.describe(`360px viewport — ${lang}`, () => {
    test.use({ viewport: { width: 360, height: 800 } });

    test('homepage renders hero + three divisions', async ({ page }) => {
      await withLang(page, lang, '');
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('.division-card')).toHaveCount(3);
    });

    test('nav is visible and the page does not scroll horizontally', async ({ page }) => {
      await withLang(page, lang, '');
      await expect(page.locator('.nav-logo')).toBeVisible();
      await expect(page.locator('.nav-cart')).toBeVisible();
      await expect(page.locator('.nav-lang')).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });

    test('division PLP lists categories from the API', async ({ page }) => {
      await withLang(page, lang, `/${CART_PRODUCT.division}`);
      await expect(page.locator('.category-card').first()).toBeVisible();
    });

    test('category PLP lists products from the API', async ({ page }) => {
      await withLang(page, lang, `/${CART_PRODUCT.division}/${CART_PRODUCT.category}`);
      await expect(page.locator('.product-card').first()).toBeVisible();
    });

    test('PDP renders the workshop plate', async ({ page }) => {
      await withLang(page, lang, pdpPath(CART_PRODUCT));
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('.workshop-plate')).toBeVisible();
      await expect(page.locator('.workshop-plate .plate-row')).not.toHaveCount(0);
    });

    test('cart page renders', async ({ page }) => {
      await withLang(page, lang, '/cart');
      await expect(page.locator('h1')).toContainText(lang === 'th' ? 'ตะกร้า' : 'Cart');
    });

    test('checkout page renders', async ({ page }) => {
      await withLang(page, lang, '/checkout');
      await expect(page.locator('h1')).toContainText(lang === 'th' ? 'ชำระเงิน' : 'Checkout');
    });
  });
}

// ============================================
// Acceptance: A11y — visible focus, real semantics, aria-live, contrast
// ============================================

test.describe('Accessibility', () => {
  test('nav links and division cards are real anchors', async ({ page }) => {
    await withLang(page, 'th', '');
    for (const selector of ['.nav-link', '.division-card']) {
      const els = page.locator(selector);
      const count = await els.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expect(els.nth(i)).toHaveJSProperty('tagName', 'A');
      }
    }
  });

  test('quantity controls are real buttons with accessible names', async ({ page }) => {
    await withLang(page, 'th', pdpPath(CART_PRODUCT));
    const buttons = page.locator('.qty-btn');
    await expect(buttons).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await expect(buttons.nth(i)).toHaveJSProperty('tagName', 'BUTTON');
      const label = await buttons.nth(i).getAttribute('aria-label');
      expect(label?.trim()).toBeTruthy();
    }
  });

  test('add-to-cart announces via an aria-live region', async ({ page }) => {
    await withLang(page, 'th', pdpPath(CART_PRODUCT));
    await page.click('.cart-section .btn-primary');

    const msg = page.locator('.cart-msg');
    await expect(msg).toBeVisible();
    await expect(msg).toHaveAttribute('aria-live', 'polite');
  });

  test('cart page exposes an aria-live status region', async ({ page }) => {
    await withLang(page, 'th', '/cart');
    const status = page.locator('.cart-status');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveAttribute('role', 'status');
  });

  test('enquiry form errors are announced with role=alert', async ({ page }) => {
    await withLang(page, 'th', pdpPath(ENQUIRY_PRODUCT));

    // Phone fails the API regex, so the server rejects and the alert must appear.
    // Native validation is switched off so the request actually reaches the API.
    await page.locator('.enquiry-form').evaluate((f) => {
      (f as HTMLFormElement).noValidate = true;
    });
    await page.fill('#name', 'ทดสอบ ระบบ');
    await page.fill('#phone', '12345');
    await page.fill('#ribbon', 'ด้วยความอาลัย');
    await page.fill('#venue', 'วัดทดสอบ');
    await page.click('.enquiry-form .btn-primary');

    await expect(page.locator('.enquiry-form .form-error')).toHaveAttribute('role', 'alert');
  });

  test('every label is associated with an existing control', async ({ page }) => {
    await withLang(page, 'th', pdpPath(ENQUIRY_PRODUCT));
    const orphans = await page.evaluate(() =>
      [...document.querySelectorAll('label[for]')]
        .map((l) => l.getAttribute('for') ?? '')
        .filter((id) => !document.getElementById(id)),
    );
    expect(orphans).toEqual([]);
  });

  test('landmarks are present and every nav has an accessible name', async ({ page }) => {
    await withLang(page, 'th', '');
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('header')).toHaveCount(1);

    const navNames = await page.evaluate(() =>
      [...document.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label') ?? ''),
    );
    expect(navNames.length).toBeGreaterThan(0);
    expect(navNames.every((n) => n.trim().length > 0)).toBe(true);
  });

  test('keyboard focus is visible when tabbing through the nav', async ({ page }) => {
    await withLang(page, 'th', '');

    // Focus the logo, then Tab once — a keyboard move is what makes
    // :focus-visible apply, which is where the outline lives.
    await page.locator('.nav-logo').focus();
    await page.keyboard.press('Tab');

    const firstLink = page.locator('.nav-link').first();
    await expect(firstLink).toBeFocused();

    const outline = await firstLink.evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: s.outlineWidth, style: s.outlineStyle };
    });
    expect(outline.style).not.toBe('none');
    expect(parseFloat(outline.width)).toBeGreaterThan(0);
  });

  test('body text meets 4.5:1 contrast against the page background', async ({ page }) => {
    await withLang(page, 'th', '');

    const ratio = await page.evaluate(() => {
      const parse = (c: string) => (c.match(/[0-9.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = (rgb: number[]) => {
        const [r, g, b] = rgb.map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
      };
      // body itself is transparent; walk up to the first painted background.
      const effectiveBg = (start: Element) => {
        let el: Element | null = start;
        while (el) {
          const bg = getComputedStyle(el).backgroundColor;
          const parts = parse(bg);
          const alpha = Number((bg.match(/[0-9.]+/g) ?? [])[3] ?? 1);
          if (alpha > 0 && parts.length === 3) return parts;
          el = el.parentElement;
        }
        return [255, 255, 255];
      };

      const style = getComputedStyle(document.body);
      const a = lum(parse(style.color));
      const b = lum(effectiveBg(document.body));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });

    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

// ============================================
// Acceptance: Thai body ≥15px, line-height ≥1.75, no uppercase transform on Thai
// ============================================

test.describe('Thai typography', () => {
  const paths = ['', `/${CART_PRODUCT.division}`, pdpPath(CART_PRODUCT), '/cart'];

  for (const path of paths) {
    test(`Thai body ≥15px and line-height ≥1.75 at ${path || '/'}`, async ({ page }) => {
      await withLang(page, 'th', path);
      const metrics = await page.evaluate(() => {
        const s = getComputedStyle(document.body);
        return { fs: parseFloat(s.fontSize), lh: parseFloat(s.lineHeight) };
      });
      expect(metrics.fs).toBeGreaterThanOrEqual(15);
      expect(metrics.lh / metrics.fs).toBeGreaterThanOrEqual(1.75);
    });

    test(`no uppercase transform on Thai at ${path || '/'}`, async ({ page }) => {
      await withLang(page, 'th', path);
      const uppercased = await page.evaluate(() =>
        [...document.querySelectorAll('body *')]
          .filter((el) => {
            const tt = getComputedStyle(el).textTransform;
            if (tt !== 'uppercase' && tt !== 'capitalize') return false;
            // Only Thai script matters — Latin labels may still be uppercased.
            return /[฀-๿]/.test(el.textContent ?? '');
          })
          .map((el) => el.tagName + '.' + String(el.className)),
      );
      expect(uppercased).toEqual([]);
    });
  }

  test('html lang attribute follows the route', async ({ page }) => {
    await withLang(page, 'th', '');
    await expect(page.locator('html')).toHaveAttribute('lang', 'th');
    await withLang(page, 'en', '');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

// ============================================
// Acceptance: enquiry-only product cannot reach cart end-to-end
// ============================================

test.describe('Enquiry-only products', () => {
  test('PDP shows the enquiry form and no add-to-cart control', async ({ page }) => {
    await withLang(page, 'th', pdpPath(ENQUIRY_PRODUCT));

    await expect(page.locator('.enquiry-form')).toBeVisible();
    await expect(page.locator('.cart-section')).toHaveCount(0);
    await expect(page.getByText('ติดต่อเจ้าหน้าที่เพื่อสั่งซื้อ')).toBeVisible();
  });

  test('funeral copy carries no exclamation marks or promo badges', async ({ page }) => {
    await withLang(page, 'th', pdpPath(ENQUIRY_PRODUCT));
    const text = (await page.locator('main').textContent()) ?? '';
    expect(text).not.toContain('!');
    expect(text).not.toContain('！');
    await expect(page.locator('.badge, .promo, .sale-badge')).toHaveCount(0);
  });

  test('cart API rejects the enquiry product directly', async ({ request }) => {
    const product = await request.get(`${API}/api/v1/catalog/products/${ENQUIRY_PRODUCT.slug}`);
    expect(product.ok()).toBeTruthy();
    const { data } = await product.json();

    const res = await request.post(`${API}/api/v1/cart`, {
      data: { productId: data.id, quantity: 1 },
    });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe('cart_enquiry_not_allowed');
    expect(body.error.message_th).toBeTruthy();
    expect(body.error.message_en).toBeTruthy();
  });

  test('checkout API rejects the enquiry product even if the cart is bypassed', async ({
    request,
  }) => {
    const product = await request.get(`${API}/api/v1/catalog/products/${ENQUIRY_PRODUCT.slug}`);
    const { data } = await product.json();

    const res = await request.post(`${API}/api/v1/checkout`, {
      data: {
        items: [{ productId: data.id, quantity: 1 }],
        contactName: 'ทดสอบ ระบบ',
        phone: '0812345678',
        shipping: {
          addrLine1: '123 ถนนทดสอบ',
          subdistrict: 'ทดสอบ',
          district: 'ทดสอบ',
          province: 'กรุงเทพมหานคร',
          postcode: '10200',
        },
      },
    });

    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe('checkout_enquiry_not_allowed');
  });
});

// ============================================
// Positive control: a cart product does reach the cart
// ============================================

test.describe('Cart flow', () => {
  test('add to cart from PDP shows the line on the cart page', async ({ page }) => {
    await withLang(page, 'th', pdpPath(CART_PRODUCT));
    await page.click('.cart-section .btn-primary');
    await expect(page.locator('.cart-msg')).toContainText('เพิ่มลงตะกร้าแล้ว');

    await gotoHydrated(page, '/th/cart');
    await expect(page.locator('.cart-item')).toHaveCount(1);
    await expect(page.locator('.cart-summary')).toBeVisible();
  });
});

// ============================================
// Acceptance: root redirect by Accept-Language with cookie override; hreflang
// ============================================

test.describe('Language routing', () => {
  test('/ redirects to /th or /en', async ({ page }) => {
    await page.goto('/');
    expect(page.url()).toMatch(/\/(th|en)$/);
  });

  test('lang cookie overrides Accept-Language', async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: 'lang', value: 'en', domain: 'localhost', path: '/' }]);
    await page.goto('/');
    expect(page.url()).toContain('/en');
  });

  test('language switcher moves to the mirrored path', async ({ page }) => {
    await withLang(page, 'th', pdpPath(CART_PRODUCT));
    await page.click('.nav-lang');
    await page.waitForURL(/\/en\//);
    expect(new URL(page.url()).pathname).toBe(`/en${pdpPath(CART_PRODUCT)}`);
  });

  test('every page carries th, en and x-default hreflang alternates', async ({ page }) => {
    for (const path of ['', `/${CART_PRODUCT.division}`, pdpPath(CART_PRODUCT), '/cart']) {
      await withLang(page, 'th', path);
      await expect(page.locator('link[rel="alternate"][hreflang="th"]')).toHaveCount(1);
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);

      const en = await page.locator('link[rel="alternate"][hreflang="en"]').getAttribute('href');
      expect(en).toBe(`/en${path}`);
    }
  });
});

// ============================================
// Acceptance: slug change produces a redirect row; old URL still resolves
// ============================================

test.describe('Slug redirects', () => {
  test('an old product URL 301s to the current one', async ({ page, request }) => {
    const oldPath = `/th/${CART_PRODUCT.division}/${CART_PRODUCT.category}/planter-old-slug`;
    const newPath = `/th${pdpPath(CART_PRODUCT)}`;

    const created = await request.post(`${API}/api/v1/redirects`, {
      data: { fromPath: oldPath, toPath: newPath, permanent: true },
    });
    expect(created.ok()).toBeTruthy();

    const lookup = await request.get(
      `${API}/api/v1/redirects/${encodeURIComponent(oldPath.slice(1))}`,
    );
    expect(lookup.ok()).toBeTruthy();
    expect((await lookup.json()).data.to).toBe(newPath);

    await page.goto(oldPath);
    expect(new URL(page.url()).pathname).toBe(newPath);
    await expect(page.locator('.workshop-plate')).toBeVisible();
  });
});

// ============================================
// Acceptance (P5): Playwright — full checkout path
// PDP -> cart -> checkout form -> order created -> backend-selected payment shown.
// The buyer never picks a rail: the API returns `rail` + `payment` and the page
// renders whatever the backend chose (QR for a tag-29/tag-30 rail, else the
// BANK_* account details).
// ============================================

test.describe('Checkout path', () => {
  test('cart to placed order renders the backend-selected payment', async ({ page }) => {
    await withLang(page, 'th', pdpPath(CART_PRODUCT));
    await page.click('.cart-section .btn-primary');
    await expect(page.locator('.cart-msg')).toContainText('เพิ่มลงตะกร้าแล้ว');

    await gotoHydrated(page, '/th/cart');
    await expect(page.locator('.cart-item')).toHaveCount(1);

    await gotoHydrated(page, '/th/checkout');
    await page.fill('#cname', 'ทดสอบ ระบบ');
    await page.fill('#cphone', '0812345678');
    await page.fill('#cemail', 'e2e@example.test');
    await page.fill('#addr1', '99/1 ถนนทดสอบ');
    await page.fill('#subdistrict', 'ในเมือง');
    await page.fill('#district', 'เมือง');
    await page.fill('#province', 'นครปฐม');
    await page.fill('#postcode', '73000');

    const placed = page.waitForResponse(
      (r) => r.url().includes('/api/v1/checkout') && r.request().method() === 'POST',
    );
    await page.click('.checkout-form .btn-primary');
    const res = await placed;
    expect(res.status()).toBe(200);

    // Order number is the bill-payment Ref1: CIDA-YYMM-NNNNN.
    const success = page.locator('.checkout-success');
    await expect(success).toBeVisible();
    await expect(success.locator('.success-order-no')).toHaveText(/^CIDA-\d{4}-\d{5}$/);

    // A payment was auto-initiated and the rail's artefact is on screen.
    const body = await res.json();
    expect(body.data.rail).toBeTruthy();
    expect(body.data.payment.status).toBe('pending');
    expect(body.data.payment.amountSatang).toBe(body.data.totalSatang);

    await expect(page.locator('.pay-step')).toBeVisible();
    if (body.data.payment.qrPayload) {
      await expect(page.locator('.pay-qr')).toBeVisible();
      // EMVCo payload, not a placeholder: version tag then the merchant tag.
      expect(body.data.payment.qrPayload).toMatch(/^000201/);
      expect(body.data.payment.qrPayload).toMatch(/29\d{2}|30\d{2}/);
    } else {
      await expect(page.locator('.pay-account')).toBeVisible();
      expect(body.data.payment.accountDetails.accountNo).toBeTruthy();
    }
  });

  test('checkout with an empty cart cannot be submitted', async ({ page }) => {
    await page.context().clearCookies();
    await withLang(page, 'th', '/checkout');
    await expect(page.locator('.checkout-form .btn-primary')).toBeDisabled();
  });
});
