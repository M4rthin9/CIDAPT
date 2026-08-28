<script lang="ts">
  import { api, ApiRequestError } from '$lib/api';
  import {
    lang,
    t,
    formatDate,
    toDateTimeInput,
    fromDateTimeInput,
    toDateInput,
    fromDateInput,
  } from '$lib/i18n.svelte';
  import Screen from '$lib/ui/Screen.svelte';
  import Modal from '$lib/ui/Modal.svelte';
  import BilingualPair from '$lib/ui/BilingualPair.svelte';

  type Tab = 'pages' | 'news' | 'events' | 'banners';

  interface Page {
    id: string;
    slugTh: string;
    slugEn: string;
    titleTh: string;
    titleEn: string;
    bodyTh: string | null;
    bodyEn: string | null;
    status: string;
    publishedAt: number | null;
  }

  interface News extends Page {
    excerptTh: string | null;
    excerptEn: string | null;
    heroImageKey: string | null;
    publishAt: number | null;
  }

  interface EventRow {
    id: string;
    titleTh: string;
    titleEn: string;
    descriptionTh: string | null;
    descriptionEn: string | null;
    locationTh: string | null;
    locationEn: string | null;
    startsAt: number;
    endsAt: number | null;
    heroImageKey: string | null;
    status: string;
  }

  interface Banner {
    id: string;
    placement: string;
    imageKey: string;
    altTh: string;
    altEn: string;
    linkPathTh: string | null;
    linkPathEn: string | null;
    sortOrder: number;
    active: boolean;
    startsAt: number | null;
    endsAt: number | null;
  }

  const TABS: { id: Tab; th: string; en: string }[] = [
    { id: 'pages', th: 'หน้าเว็บ', en: 'Pages' },
    { id: 'news', th: 'ข่าว', en: 'News' },
    { id: 'events', th: 'กิจกรรม', en: 'Events' },
    { id: 'banners', th: 'แบนเนอร์', en: 'Banners' },
  ];

  let tab = $state<Tab>('pages');
  let loading = $state(true);
  let error = $state('');
  let notice = $state('');
  let busy = $state(false);

  let pages = $state<Page[]>([]);
  let news = $state<News[]>([]);
  let events = $state<EventRow[]>([]);
  let banners = $state<Banner[]>([]);

  /**
   * Editor buffers. Every field is a plain string so `bind:value` and
   * `BilingualPair` never have to deal with `null` — the nullable columns are
   * reconstituted by `orNull` at save time.
   */
  interface PageDraft {
    id: string;
    slugTh: string;
    slugEn: string;
    titleTh: string;
    titleEn: string;
    bodyTh: string;
    bodyEn: string;
    status: string;
  }

  interface NewsDraft extends PageDraft {
    excerptTh: string;
    excerptEn: string;
    heroImageKey: string;
    publishAtInput: string;
  }

  interface EventDraft {
    id: string;
    titleTh: string;
    titleEn: string;
    descriptionTh: string;
    descriptionEn: string;
    locationTh: string;
    locationEn: string;
    heroImageKey: string;
    status: string;
    startsAtInput: string;
    endsAtInput: string;
  }

  interface BannerDraft {
    id: string;
    placement: string;
    imageKey: string;
    altTh: string;
    altEn: string;
    linkPathTh: string;
    linkPathEn: string;
    sortOrder: number;
    active: boolean;
    startsAtInput: string;
    endsAtInput: string;
  }

  // One draft slot per entity kind — only one editor is open at a time.
  let pageDraft = $state<PageDraft | null>(null);
  let newsDraft = $state<NewsDraft | null>(null);
  let eventDraft = $state<EventDraft | null>(null);
  let bannerDraft = $state<BannerDraft | null>(null);

  function describe(err: unknown, fallbackTh: string, fallbackEn: string): string {
    return err instanceof ApiRequestError
      ? lang.pick(err.message_th, err.message_en)
      : t(fallbackTh, fallbackEn);
  }

  const orNull = (v: string) => (v.trim() === '' ? null : v.trim());

  async function load() {
    loading = true;
    error = '';
    try {
      if (tab === 'pages') pages = await api<Page[]>('/admin/content/pages');
      else if (tab === 'news') news = await api<News[]>('/admin/content/news');
      else if (tab === 'events') events = await api<EventRow[]>('/admin/content/events');
      else banners = await api<Banner[]>('/admin/content/banners');
    } catch (err) {
      error = describe(err, 'โหลดเนื้อหาไม่สำเร็จ', 'Could not load content');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });

  async function afterSave(msgTh: string, msgEn: string) {
    notice = t(msgTh, msgEn);
    pageDraft = null;
    newsDraft = null;
    eventDraft = null;
    bannerDraft = null;
    await load();
  }

  function fail(err: unknown) {
    error = describe(
      err,
      'บันทึกไม่สำเร็จ — การเผยแพร่ต้องกรอกครบทั้งสองภาษา',
      'Save failed — publishing requires both languages',
    );
  }

  // ---------------- Pages ----------------

  function newPage() {
    pageDraft = {
      id: '',
      slugTh: '',
      slugEn: '',
      titleTh: '',
      titleEn: '',
      bodyTh: '',
      bodyEn: '',
      status: 'draft',
    };
  }

  function editPage(p: Page) {
    pageDraft = {
      id: p.id,
      slugTh: p.slugTh,
      slugEn: p.slugEn,
      titleTh: p.titleTh,
      titleEn: p.titleEn,
      bodyTh: p.bodyTh ?? '',
      bodyEn: p.bodyEn ?? '',
      status: p.status,
    };
  }

  async function savePage() {
    if (!pageDraft) return;
    busy = true;
    error = '';
    try {
      await api('/admin/content/pages', {
        method: 'POST',
        body: JSON.stringify({
          slugTh: pageDraft.slugTh.trim(),
          slugEn: pageDraft.slugEn.trim(),
          titleTh: pageDraft.titleTh.trim(),
          titleEn: pageDraft.titleEn.trim(),
          bodyTh: orNull(pageDraft.bodyTh),
          bodyEn: orNull(pageDraft.bodyEn),
          status: pageDraft.status,
        }),
      });
      await afterSave('บันทึกหน้าแล้ว', 'Page saved');
    } catch (err) {
      fail(err);
    } finally {
      busy = false;
    }
  }

  // ---------------- News ----------------

  function newNews() {
    newsDraft = {
      id: '',
      slugTh: '',
      slugEn: '',
      titleTh: '',
      titleEn: '',
      excerptTh: '',
      excerptEn: '',
      bodyTh: '',
      bodyEn: '',
      heroImageKey: '',
      status: 'draft',
      publishAtInput: '',
    };
  }

  function editNews(n: News) {
    newsDraft = {
      id: n.id,
      slugTh: n.slugTh,
      slugEn: n.slugEn,
      titleTh: n.titleTh,
      titleEn: n.titleEn,
      excerptTh: n.excerptTh ?? '',
      excerptEn: n.excerptEn ?? '',
      bodyTh: n.bodyTh ?? '',
      bodyEn: n.bodyEn ?? '',
      heroImageKey: n.heroImageKey ?? '',
      status: n.status,
      publishAtInput: toDateInput(n.publishAt),
    };
  }

  async function saveNews() {
    if (!newsDraft) return;
    busy = true;
    error = '';
    try {
      await api('/admin/content/news', {
        method: 'POST',
        body: JSON.stringify({
          slugTh: newsDraft.slugTh.trim(),
          slugEn: newsDraft.slugEn.trim(),
          titleTh: newsDraft.titleTh.trim(),
          titleEn: newsDraft.titleEn.trim(),
          excerptTh: orNull(newsDraft.excerptTh),
          excerptEn: orNull(newsDraft.excerptEn),
          bodyTh: orNull(newsDraft.bodyTh),
          bodyEn: orNull(newsDraft.bodyEn),
          heroImageKey: orNull(newsDraft.heroImageKey),
          status: newsDraft.status,
          publishAt: fromDateInput(newsDraft.publishAtInput),
        }),
      });
      await afterSave('บันทึกข่าวแล้ว', 'News post saved');
    } catch (err) {
      fail(err);
    } finally {
      busy = false;
    }
  }

  // ---------------- Events ----------------

  function newEvent() {
    eventDraft = {
      id: '',
      titleTh: '',
      titleEn: '',
      descriptionTh: '',
      descriptionEn: '',
      locationTh: '',
      locationEn: '',
      heroImageKey: '',
      status: 'draft',
      startsAtInput: '',
      endsAtInput: '',
    };
  }

  function editEvent(e: EventRow) {
    eventDraft = {
      id: e.id,
      titleTh: e.titleTh,
      titleEn: e.titleEn,
      descriptionTh: e.descriptionTh ?? '',
      descriptionEn: e.descriptionEn ?? '',
      locationTh: e.locationTh ?? '',
      locationEn: e.locationEn ?? '',
      heroImageKey: e.heroImageKey ?? '',
      status: e.status,
      startsAtInput: toDateTimeInput(e.startsAt),
      endsAtInput: toDateTimeInput(e.endsAt),
    };
  }

  async function saveEvent() {
    if (!eventDraft) return;
    const startsAt = fromDateTimeInput(eventDraft.startsAtInput);
    if (startsAt === null) {
      error = t('ต้องระบุวันเริ่มกิจกรรม', 'Event start time is required');
      return;
    }
    busy = true;
    error = '';
    try {
      const body = JSON.stringify({
        titleTh: eventDraft.titleTh.trim(),
        titleEn: eventDraft.titleEn.trim(),
        descriptionTh: orNull(eventDraft.descriptionTh),
        descriptionEn: orNull(eventDraft.descriptionEn),
        locationTh: orNull(eventDraft.locationTh),
        locationEn: orNull(eventDraft.locationEn),
        heroImageKey: orNull(eventDraft.heroImageKey),
        status: eventDraft.status,
        startsAt,
        endsAt: fromDateTimeInput(eventDraft.endsAtInput),
      });
      if (eventDraft.id) {
        await api(`/admin/content/events/${eventDraft.id}`, { method: 'PUT', body });
      } else {
        await api('/admin/content/events', { method: 'POST', body });
      }
      await afterSave('บันทึกกิจกรรมแล้ว', 'Event saved');
    } catch (err) {
      fail(err);
    } finally {
      busy = false;
    }
  }

  // ---------------- Banners ----------------

  function newBanner() {
    bannerDraft = {
      id: '',
      placement: 'home_hero',
      imageKey: '',
      altTh: '',
      altEn: '',
      linkPathTh: '',
      linkPathEn: '',
      sortOrder: 0,
      active: true,
      startsAtInput: '',
      endsAtInput: '',
    };
  }

  function editBanner(b: Banner) {
    bannerDraft = {
      id: b.id,
      placement: b.placement,
      imageKey: b.imageKey,
      altTh: b.altTh,
      altEn: b.altEn,
      linkPathTh: b.linkPathTh ?? '',
      linkPathEn: b.linkPathEn ?? '',
      sortOrder: b.sortOrder,
      active: b.active,
      startsAtInput: toDateTimeInput(b.startsAt),
      endsAtInput: toDateTimeInput(b.endsAt),
    };
  }

  async function saveBanner() {
    if (!bannerDraft) return;
    busy = true;
    error = '';
    try {
      const body = JSON.stringify({
        placement: bannerDraft.placement,
        imageKey: bannerDraft.imageKey.trim(),
        altTh: bannerDraft.altTh.trim(),
        altEn: bannerDraft.altEn.trim(),
        linkPathTh: orNull(bannerDraft.linkPathTh),
        linkPathEn: orNull(bannerDraft.linkPathEn),
        sortOrder: Number(bannerDraft.sortOrder) || 0,
        active: bannerDraft.active,
        startsAt: fromDateTimeInput(bannerDraft.startsAtInput),
        endsAt: fromDateTimeInput(bannerDraft.endsAtInput),
      });
      if (bannerDraft.id) {
        await api(`/admin/content/banners/${bannerDraft.id}`, { method: 'PUT', body });
      } else {
        await api('/admin/content/banners', { method: 'POST', body });
      }
      await afterSave('บันทึกแบนเนอร์แล้ว', 'Banner saved');
    } catch (err) {
      fail(err);
    } finally {
      busy = false;
    }
  }

  // ---------------- Delete ----------------

  let pendingDelete = $state<{ kind: string; id: string; label: string } | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) return;
    busy = true;
    error = '';
    try {
      await api(`/admin/content/${pendingDelete.kind}/${pendingDelete.id}`, { method: 'DELETE' });
      pendingDelete = null;
      await afterSave('ลบแล้ว', 'Deleted');
    } catch (err) {
      error = describe(err, 'ลบไม่สำเร็จ', 'Could not delete');
    } finally {
      busy = false;
    }
  }
</script>

<Screen
  title={t('เนื้อหา', 'Content')}
  subtitle={t(
    'หน้าเว็บ ข่าว กิจกรรม และแบนเนอร์ — เผยแพร่ได้เมื่อครบทั้งสองภาษา',
    'Pages, news, events and banners — publishing requires both languages',
  )}
  {loading}
  {error}
  {notice}
>
  {#snippet actions()}
    {#if tab === 'pages'}
      <button class="btn btn-primary" onclick={newPage}>{t('เพิ่มหน้า', 'New page')}</button>
    {:else if tab === 'news'}
      <button class="btn btn-primary" onclick={newNews}>{t('เพิ่มข่าว', 'New post')}</button>
    {:else if tab === 'events'}
      <button class="btn btn-primary" onclick={newEvent}>{t('เพิ่มกิจกรรม', 'New event')}</button>
    {:else}
      <button class="btn btn-primary" onclick={newBanner}>{t('เพิ่มแบนเนอร์', 'New banner')}</button
      >
    {/if}
  {/snippet}

  <div class="toolbar" role="tablist" aria-label={t('ประเภทเนื้อหา', 'Content type')}>
    {#each TABS as item (item.id)}
      <button
        class="btn"
        class:btn-primary={tab === item.id}
        role="tab"
        aria-selected={tab === item.id}
        onclick={() => (tab = item.id)}
      >
        {lang.pick(item.th, item.en)}
      </button>
    {/each}
  </div>

  {#if tab === 'pages'}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t('ชื่อเรื่อง', 'Title')}</th>
            <th>Slug</th>
            <th>{t('สถานะ', 'Status')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each pages as p (p.id)}
            <tr>
              <td>{p.titleTh || '—'}<br /><span class="muted">{p.titleEn || '—'}</span></td>
              <td class="num">{p.slugTh} / {p.slugEn}</td>
              <td><span class="badge badge-{p.status}">{p.status}</span></td>
              <td class="actions">
                <button class="btn" onclick={() => editPage(p)}>
                  {t('แก้ไข', 'Edit')}
                </button>
                <button
                  class="btn btn-danger"
                  onclick={() => (pendingDelete = { kind: 'pages', id: p.id, label: p.titleTh })}
                >
                  {t('ลบ', 'Delete')}
                </button>
              </td>
            </tr>
          {:else}
            <tr><td colspan="4" class="muted">{t('ยังไม่มีหน้า', 'No pages yet')}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else if tab === 'news'}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t('ชื่อเรื่อง', 'Title')}</th>
            <th>Slug</th>
            <th>{t('สถานะ', 'Status')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each news as n (n.id)}
            <tr>
              <td>{n.titleTh || '—'}<br /><span class="muted">{n.titleEn || '—'}</span></td>
              <td class="num">{n.slugTh} / {n.slugEn}</td>
              <td><span class="badge badge-{n.status}">{n.status}</span></td>
              <td class="actions">
                <button class="btn" onclick={() => editNews(n)}>{t('แก้ไข', 'Edit')}</button>
                <button
                  class="btn btn-danger"
                  onclick={() => (pendingDelete = { kind: 'news', id: n.id, label: n.titleTh })}
                >
                  {t('ลบ', 'Delete')}
                </button>
              </td>
            </tr>
          {:else}
            <tr><td colspan="4" class="muted">{t('ยังไม่มีข่าว', 'No posts yet')}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else if tab === 'events'}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t('ชื่อกิจกรรม', 'Event')}</th>
            <th>{t('เริ่ม', 'Starts')}</th>
            <th>{t('สถานะ', 'Status')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each events as e (e.id)}
            <tr>
              <td>{e.titleTh || '—'}<br /><span class="muted">{e.titleEn || '—'}</span></td>
              <td>{formatDate(e.startsAt)}</td>
              <td><span class="badge badge-{e.status}">{e.status}</span></td>
              <td class="actions">
                <button class="btn" onclick={() => editEvent(e)}>{t('แก้ไข', 'Edit')}</button>
                <button
                  class="btn btn-danger"
                  onclick={() => (pendingDelete = { kind: 'events', id: e.id, label: e.titleTh })}
                >
                  {t('ลบ', 'Delete')}
                </button>
              </td>
            </tr>
          {:else}
            <tr><td colspan="4" class="muted">{t('ยังไม่มีกิจกรรม', 'No events yet')}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t('ตำแหน่ง', 'Placement')}</th>
            <th>{t('คำอธิบายภาพ', 'Alt text')}</th>
            <th class="num">{t('ลำดับ', 'Order')}</th>
            <th>{t('สถานะ', 'Status')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each banners as b (b.id)}
            <tr>
              <td>{b.placement}</td>
              <td>{b.altTh}<br /><span class="muted">{b.altEn}</span></td>
              <td class="num">{b.sortOrder}</td>
              <td>
                <span class="badge badge-{b.active ? 'published' : 'archived'}">
                  {b.active ? t('ใช้งาน', 'Active') : t('ปิด', 'Inactive')}
                </span>
              </td>
              <td class="actions">
                <button class="btn" onclick={() => editBanner(b)}>{t('แก้ไข', 'Edit')}</button>
                <button
                  class="btn btn-danger"
                  onclick={() => (pendingDelete = { kind: 'banners', id: b.id, label: b.altTh })}
                >
                  {t('ลบ', 'Delete')}
                </button>
              </td>
            </tr>
          {:else}
            <tr><td colspan="5" class="muted">{t('ยังไม่มีแบนเนอร์', 'No banners yet')}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Screen>

{#if pageDraft}
  <Modal
    title={pageDraft.id ? t('แก้ไขหน้า', 'Edit page') : t('เพิ่มหน้า', 'New page')}
    {busy}
    onclose={() => (pageDraft = null)}
    onsave={savePage}
  >
    <div class="field-row">
      <label class="field">
        Slug (TH)
        <input type="text" bind:value={pageDraft.slugTh} disabled={pageDraft.id !== ''} />
      </label>
      <label class="field">
        Slug (EN)
        <input type="text" bind:value={pageDraft.slugEn} />
      </label>
      <label class="field">
        {t('สถานะ', 'Status')}
        <select bind:value={pageDraft.status}>
          <option value="draft">{t('ฉบับร่าง', 'Draft')}</option>
          <option value="published">{t('เผยแพร่', 'Published')}</option>
        </select>
      </label>
    </div>
    <BilingualPair
      legend={t('ชื่อเรื่อง', 'Title')}
      bind:th={pageDraft.titleTh}
      bind:en={pageDraft.titleEn}
      requiredToPublish
    />
    <BilingualPair
      legend={t('เนื้อหา', 'Body')}
      bind:th={pageDraft.bodyTh}
      bind:en={pageDraft.bodyEn}
      multiline
      requiredToPublish
    />
  </Modal>
{/if}

{#if newsDraft}
  <Modal
    title={newsDraft.id ? t('แก้ไขข่าว', 'Edit post') : t('เพิ่มข่าว', 'New post')}
    {busy}
    onclose={() => (newsDraft = null)}
    onsave={saveNews}
  >
    <div class="field-row">
      <label class="field">
        Slug (TH)
        <input type="text" bind:value={newsDraft.slugTh} disabled={newsDraft.id !== ''} />
      </label>
      <label class="field">
        Slug (EN)
        <input type="text" bind:value={newsDraft.slugEn} />
      </label>
      <label class="field">
        {t('กำหนดเผยแพร่', 'Publish on')}
        <input type="date" bind:value={newsDraft.publishAtInput} />
      </label>
      <label class="field">
        {t('สถานะ', 'Status')}
        <select bind:value={newsDraft.status}>
          <option value="draft">{t('ฉบับร่าง', 'Draft')}</option>
          <option value="published">{t('เผยแพร่', 'Published')}</option>
        </select>
      </label>
    </div>
    <BilingualPair
      legend={t('ชื่อเรื่อง', 'Title')}
      bind:th={newsDraft.titleTh}
      bind:en={newsDraft.titleEn}
      requiredToPublish
    />
    <BilingualPair
      legend={t('เกริ่นนำ', 'Excerpt')}
      bind:th={newsDraft.excerptTh}
      bind:en={newsDraft.excerptEn}
      multiline
    />
    <BilingualPair
      legend={t('เนื้อหา', 'Body')}
      bind:th={newsDraft.bodyTh}
      bind:en={newsDraft.bodyEn}
      multiline
      requiredToPublish
    />
  </Modal>
{/if}

{#if eventDraft}
  <Modal
    title={eventDraft.id ? t('แก้ไขกิจกรรม', 'Edit event') : t('เพิ่มกิจกรรม', 'New event')}
    {busy}
    onclose={() => (eventDraft = null)}
    onsave={saveEvent}
  >
    <div class="field-row">
      <label class="field">
        {t('เริ่ม', 'Starts')}
        <input type="datetime-local" bind:value={eventDraft.startsAtInput} />
      </label>
      <label class="field">
        {t('สิ้นสุด', 'Ends')}
        <input type="datetime-local" bind:value={eventDraft.endsAtInput} />
      </label>
      <label class="field">
        {t('สถานะ', 'Status')}
        <select bind:value={eventDraft.status}>
          <option value="draft">{t('ฉบับร่าง', 'Draft')}</option>
          <option value="published">{t('เผยแพร่', 'Published')}</option>
        </select>
      </label>
    </div>
    <BilingualPair
      legend={t('ชื่อกิจกรรม', 'Title')}
      bind:th={eventDraft.titleTh}
      bind:en={eventDraft.titleEn}
      requiredToPublish
    />
    <BilingualPair
      legend={t('รายละเอียด', 'Description')}
      bind:th={eventDraft.descriptionTh}
      bind:en={eventDraft.descriptionEn}
      multiline
      requiredToPublish
    />
    <BilingualPair
      legend={t('สถานที่', 'Location')}
      bind:th={eventDraft.locationTh}
      bind:en={eventDraft.locationEn}
    />
  </Modal>
{/if}

{#if bannerDraft}
  <Modal
    title={bannerDraft.id ? t('แก้ไขแบนเนอร์', 'Edit banner') : t('เพิ่มแบนเนอร์', 'New banner')}
    {busy}
    onclose={() => (bannerDraft = null)}
    onsave={saveBanner}
  >
    <div class="field-row">
      <label class="field">
        {t('ตำแหน่ง', 'Placement')}
        <select bind:value={bannerDraft.placement}>
          <option value="home_hero">home_hero</option>
          <option value="home_promo">home_promo</option>
        </select>
      </label>
      <label class="field">
        {t('คีย์รูปภาพ', 'Image key')}
        <input type="text" bind:value={bannerDraft.imageKey} />
      </label>
      <label class="field">
        {t('ลำดับ', 'Sort order')}
        <input type="number" min="0" step="1" bind:value={bannerDraft.sortOrder} />
      </label>
      <label class="field">
        {t('เริ่มแสดง', 'Starts')}
        <input type="datetime-local" bind:value={bannerDraft.startsAtInput} />
      </label>
      <label class="field">
        {t('หยุดแสดง', 'Ends')}
        <input type="datetime-local" bind:value={bannerDraft.endsAtInput} />
      </label>
    </div>
    <BilingualPair
      legend={t('คำอธิบายภาพ (จำเป็น)', 'Alt text (required)')}
      bind:th={bannerDraft.altTh}
      bind:en={bannerDraft.altEn}
      requiredToPublish
    />
    <BilingualPair
      legend={t('ลิงก์ปลายทาง', 'Link path')}
      bind:th={bannerDraft.linkPathTh}
      bind:en={bannerDraft.linkPathEn}
    />
    <label class="check">
      <input type="checkbox" bind:checked={bannerDraft.active} />
      {t('เปิดใช้งาน', 'Active')}
    </label>
  </Modal>
{/if}

{#if pendingDelete}
  <Modal
    title={t('ยืนยันการลบ', 'Confirm delete')}
    {busy}
    saveLabel={t('ลบ', 'Delete')}
    onclose={() => (pendingDelete = null)}
    onsave={confirmDelete}
  >
    <p>{t(`ต้องการลบ "${pendingDelete.label}" หรือไม่?`, `Delete "${pendingDelete.label}"?`)}</p>
  </Modal>
{/if}

<style>
  .actions {
    white-space: nowrap;
  }
  .actions .btn + .btn {
    margin-left: 0.25rem;
  }
</style>
