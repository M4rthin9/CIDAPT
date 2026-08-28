<script lang="ts">
  import { api, ApiRequestError } from '$lib/api';
  import { lang, t, formatSatang } from '$lib/i18n.svelte';
  import Screen from '$lib/ui/Screen.svelte';
  import Modal from '$lib/ui/Modal.svelte';
  import BilingualPair from '$lib/ui/BilingualPair.svelte';

  interface ProductRow {
    id: string;
    sku: string;
    nameTh: string;
    nameEn: string;
    categoryId: string;
    purchaseMode: string;
    status: string;
    priceSatang: number | null;
    stockOnHand: number;
  }

  interface Category {
    id: string;
    nameTh: string;
    nameEn: string;
    divisionCode: string;
  }

  interface Division {
    code: string;
    nameTh: string;
    nameEn: string;
  }

  /** Editor buffer — mirrors `productUpsertSchema`. */
  interface Draft {
    id: string | null;
    sku: string;
    categoryId: string;
    purchaseMode: 'cart' | 'enquiry';
    lotCode: string;
    nameTh: string;
    nameEn: string;
    bodyTh: string;
    bodyEn: string;
    materialTh: string;
    materialEn: string;
    finishNoteTh: string;
    finishNoteEn: string;
    priceBaht: string;
  }

  function blankDraft(categoryId: string): Draft {
    return {
      id: null,
      sku: '',
      categoryId,
      purchaseMode: 'cart',
      lotCode: '',
      nameTh: '',
      nameEn: '',
      bodyTh: '',
      bodyEn: '',
      materialTh: '',
      materialEn: '',
      finishNoteTh: '',
      finishNoteEn: '',
      priceBaht: '',
    };
  }

  let products = $state<ProductRow[]>([]);
  let categories = $state<Category[]>([]);
  let divisions = $state<Division[]>([]);
  let loading = $state(true);
  let error = $state('');
  let notice = $state('');
  let filterStatus = $state('');

  let draft = $state<Draft | null>(null);
  let busy = $state(false);

  function describe(err: unknown, fallbackTh: string, fallbackEn: string): string {
    return err instanceof ApiRequestError
      ? lang.pick(err.message_th, err.message_en)
      : t(fallbackTh, fallbackEn);
  }

  async function loadTaxonomy() {
    divisions = await api<Division[]>('/admin/catalog/divisions');
    const lists = await Promise.all(
      divisions.map((d) => api<Category[]>(`/admin/catalog/divisions/${d.code}/categories`)),
    );
    categories = lists.flat();
  }

  async function load() {
    loading = true;
    error = '';
    try {
      if (divisions.length === 0) await loadTaxonomy();
      const qs = filterStatus ? `?status=${encodeURIComponent(filterStatus)}` : '';
      products = await api<ProductRow[]>(`/admin/catalog/products${qs}`);
    } catch (err) {
      error = describe(err, 'โหลดสินค้าไม่สำเร็จ', 'Could not load products');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });

  const categoryName = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    return cat ? lang.pick(cat.nameTh, cat.nameEn) : '—';
  };

  function newProduct() {
    if (categories.length === 0) {
      error = t('ต้องสร้างหมวดหมู่ก่อน', 'Create a category first');
      return;
    }
    draft = blankDraft(categories[0]!.id);
  }

  async function edit(row: ProductRow) {
    error = '';
    try {
      // The list projection is trimmed; fetch the full row to edit bodies.
      const full = await api<Record<string, unknown>>(`/admin/catalog/products/${row.id}`);
      const str = (k: string) => (full[k] as string | null) ?? '';
      draft = {
        id: row.id,
        sku: str('sku'),
        categoryId: str('categoryId'),
        purchaseMode: (full['purchaseMode'] as 'cart' | 'enquiry') ?? 'cart',
        lotCode: str('lotCode'),
        nameTh: str('nameTh'),
        nameEn: str('nameEn'),
        bodyTh: str('bodyTh'),
        bodyEn: str('bodyEn'),
        materialTh: str('materialTh'),
        materialEn: str('materialEn'),
        finishNoteTh: str('finishNoteTh'),
        finishNoteEn: str('finishNoteEn'),
        priceBaht:
          full['priceSatang'] === null || full['priceSatang'] === undefined
            ? ''
            : String((full['priceSatang'] as number) / 100),
      };
    } catch (err) {
      error = describe(err, 'โหลดสินค้าไม่สำเร็จ', 'Could not load product');
    }
  }

  /** Draft → `productUpsertSchema` body. Empty optional text becomes null. */
  function toBody(d: Draft) {
    const orNull = (v: string) => (v.trim() === '' ? null : v.trim());
    const baht = d.priceBaht.trim();
    return {
      sku: d.sku.trim().toUpperCase(),
      categoryId: d.categoryId,
      purchaseMode: d.purchaseMode,
      lotCode: d.lotCode.trim().toUpperCase(),
      nameTh: d.nameTh.trim(),
      nameEn: d.nameEn.trim(),
      bodyTh: orNull(d.bodyTh),
      bodyEn: orNull(d.bodyEn),
      materialTh: orNull(d.materialTh),
      materialEn: orNull(d.materialEn),
      finishNoteTh: orNull(d.finishNoteTh),
      finishNoteEn: orNull(d.finishNoteEn),
      priceSatang: baht === '' ? null : Math.round(Number(baht) * 100),
    };
  }

  async function save() {
    if (!draft) return;
    busy = true;
    error = '';
    try {
      const body = JSON.stringify(toBody(draft));
      if (draft.id) {
        await api(`/admin/catalog/products/${draft.id}`, { method: 'PUT', body });
      } else {
        await api('/admin/catalog/products', { method: 'POST', body });
      }
      notice = t('บันทึกสินค้าแล้ว', 'Product saved');
      draft = null;
      await load();
    } catch (err) {
      error = describe(err, 'บันทึกสินค้าไม่สำเร็จ', 'Could not save product');
    } finally {
      busy = false;
    }
  }

  /**
   * Publish sends the full record so the server can re-run the both-languages
   * gate. A 422 here is the gate doing its job — surface the message as-is.
   */
  async function publish(row: ProductRow) {
    error = '';
    try {
      const full = await api<Record<string, unknown>>(`/admin/catalog/products/${row.id}`);
      await api(`/admin/catalog/products/${row.id}/publish`, {
        method: 'POST',
        body: JSON.stringify({
          sku: full['sku'],
          categoryId: full['categoryId'],
          purchaseMode: full['purchaseMode'],
          lotCode: full['lotCode'],
          nameTh: full['nameTh'] ?? '',
          nameEn: full['nameEn'] ?? '',
          bodyTh: full['bodyTh'] ?? null,
          bodyEn: full['bodyEn'] ?? null,
          materialTh: full['materialTh'] ?? null,
          materialEn: full['materialEn'] ?? null,
          finishNoteTh: full['finishNoteTh'] ?? null,
          finishNoteEn: full['finishNoteEn'] ?? null,
          priceSatang: full['priceSatang'] ?? null,
          status: 'published',
        }),
      });
      notice = t('เผยแพร่สินค้าแล้ว', 'Product published');
      await load();
    } catch (err) {
      error = describe(
        err,
        'เผยแพร่ไม่สำเร็จ — ต้องกรอกครบทั้งสองภาษา',
        'Publish failed — both languages are required',
      );
    }
  }

  async function archive(row: ProductRow) {
    error = '';
    try {
      await api(`/admin/catalog/products/${row.id}/archive`, { method: 'POST' });
      notice = t('เก็บเข้าคลังแล้ว', 'Product archived');
      await load();
    } catch (err) {
      error = describe(err, 'เก็บเข้าคลังไม่สำเร็จ', 'Could not archive product');
    }
  }
</script>

<Screen
  title={t('สินค้า', 'Products')}
  subtitle={t(
    'ต้องกรอกครบทั้งภาษาไทยและอังกฤษจึงจะเผยแพร่ได้',
    'Both Thai and English are required before a product can be published',
  )}
  {loading}
  {error}
  {notice}
>
  {#snippet actions()}
    <button class="btn btn-primary" onclick={newProduct}>{t('เพิ่มสินค้า', 'New product')}</button>
  {/snippet}

  <div class="toolbar">
    <label class="field inline">
      {t('สถานะ', 'Status')}
      <select bind:value={filterStatus}>
        <option value="">{t('ทั้งหมด', 'All')}</option>
        <option value="draft">{t('ฉบับร่าง', 'Draft')}</option>
        <option value="published">{t('เผยแพร่', 'Published')}</option>
        <option value="archived">{t('เก็บแล้ว', 'Archived')}</option>
      </select>
    </label>
  </div>

  {#if products.length === 0}
    <p class="muted">{t('ยังไม่มีสินค้า', 'No products yet')}</p>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>{t('ชื่อ', 'Name')}</th>
            <th>{t('หมวดหมู่', 'Category')}</th>
            <th>{t('การซื้อ', 'Mode')}</th>
            <th class="num">{t('ราคา (บาท)', 'Price (THB)')}</th>
            <th class="num">{t('คงเหลือ', 'Stock')}</th>
            <th>{t('สถานะ', 'Status')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each products as p (p.id)}
            <tr>
              <td class="num">{p.sku}</td>
              <td>
                {p.nameTh || '—'}<br />
                <span class="muted">{p.nameEn || t('ยังไม่มีภาษาอังกฤษ', 'English missing')}</span>
              </td>
              <td>{categoryName(p.categoryId)}</td>
              <td>{p.purchaseMode === 'cart' ? t('ตะกร้า', 'Cart') : t('สอบถาม', 'Enquiry')}</td>
              <td class="num">{formatSatang(p.priceSatang)}</td>
              <td class="num">{p.stockOnHand}</td>
              <td><span class="badge badge-{p.status}">{p.status}</span></td>
              <td class="actions">
                <button class="btn" onclick={() => edit(p)}>{t('แก้ไข', 'Edit')}</button>
                {#if p.status !== 'published'}
                  <button class="btn" onclick={() => publish(p)}>{t('เผยแพร่', 'Publish')}</button>
                {/if}
                {#if p.status !== 'archived'}
                  <button class="btn btn-danger" onclick={() => archive(p)}>
                    {t('เก็บ', 'Archive')}
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Screen>

{#if draft}
  <Modal
    title={draft.id ? t('แก้ไขสินค้า', 'Edit product') : t('เพิ่มสินค้า', 'New product')}
    {busy}
    onclose={() => (draft = null)}
    onsave={save}
  >
    <div class="field-row">
      <label class="field">
        SKU
        <input type="text" bind:value={draft.sku} />
      </label>
      <label class="field">
        {t('รหัสล็อต (จำเป็น)', 'Lot code (required)')}
        <!-- productCore requires /^[A-Z0-9-]{1,24}$/ — uppercased on save. -->
        <input type="text" bind:value={draft.lotCode} required placeholder="LOT-2026-01" />
      </label>
      <label class="field">
        {t('หมวดหมู่', 'Category')}
        <select bind:value={draft.categoryId}>
          {#each categories as c (c.id)}
            <option value={c.id}>{lang.pick(c.nameTh, c.nameEn)}</option>
          {/each}
        </select>
      </label>
      <label class="field">
        {t('วิธีการซื้อ', 'Purchase mode')}
        <select bind:value={draft.purchaseMode}>
          <option value="cart">{t('ตะกร้า', 'Cart')}</option>
          <option value="enquiry">{t('สอบถาม', 'Enquiry')}</option>
        </select>
      </label>
      <label class="field">
        {t('ราคา (บาท)', 'Price (THB)')}
        <input
          type="number"
          step="0.01"
          min="0"
          bind:value={draft.priceBaht}
          disabled={draft.purchaseMode === 'enquiry'}
        />
      </label>
    </div>

    <BilingualPair
      legend={t('ชื่อสินค้า', 'Product name')}
      bind:th={draft.nameTh}
      bind:en={draft.nameEn}
      requiredToPublish
    />
    <BilingualPair
      legend={t('รายละเอียด', 'Description')}
      bind:th={draft.bodyTh}
      bind:en={draft.bodyEn}
      multiline
      requiredToPublish
    />
    <BilingualPair
      legend={t('วัสดุ', 'Material')}
      bind:th={draft.materialTh}
      bind:en={draft.materialEn}
    />
    <BilingualPair
      legend={t('หมายเหตุการตกแต่ง', 'Finish note')}
      bind:th={draft.finishNoteTh}
      bind:en={draft.finishNoteEn}
    />
  </Modal>
{/if}

<style>
  .field.inline {
    margin-bottom: 0;
  }
  .actions {
    white-space: nowrap;
  }
  .actions .btn + .btn {
    margin-left: 0.25rem;
  }
</style>
