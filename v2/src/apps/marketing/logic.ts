// @ts-nocheck
/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing — the dealer's own workspace.

   Everything on this screen belongs to the signed-in dealer and comes
   from the one canonical marketing record: marketing_creatives, the
   asset the operator actually produced, the caption stored with it, and
   the publication rows that say what has genuinely been posted.

   Nothing here is invented. There are no sample properties, no sample
   posts, no simulated publish and no metrics that did not come from a
   platform. A dealer with no creatives yet is told so plainly — that is
   the honest state for a new dealer, and it is the first thing a first
   client will see.
   ═══════════════════════════════════════════════════════════════ */
import { DCLogic } from '../../framework/dc';
import { loadDealerMarketingFeed } from '../../packages/marketing/dealer-feed';
import {
  adapterFor, capabilitiesFor, displayFor, publishingEnabled, CHANNEL_LABEL,
} from '../../packages/marketing/publishing';

/** The four channels MAPCO markets through, in the order they are shown. */
const CHANNELS = [
  { id: 'instagram', short: 'Instagram', icon: 'ph-fill ph-instagram-logo', color: '#E1306C' },
  { id: 'facebook_page', short: 'Facebook', icon: 'ph-fill ph-facebook-logo', color: '#1877F2' },
  { id: 'google_business', short: 'Google', icon: 'ph-fill ph-google-logo', color: '#EA4335' },
  { id: 'whatsapp_business', short: 'WhatsApp', icon: 'ph-fill ph-whatsapp-logo', color: '#25D366' },
];

const TABS = [
  { id: 'today', label: 'Today', icon: 'ph-fill ph-sun-horizon' },
  { id: 'reels', label: 'Reels', icon: 'ph-fill ph-film-slate' },
  { id: 'library', label: 'Library', icon: 'ph-fill ph-squares-four' },
  { id: 'performance', label: 'Performance', icon: 'ph-fill ph-chart-line-up' },
];

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export class Component extends DCLogic {
  state = {
    section: 'today',
    loading: true,
    /* A load that failed is reported. It is never quietly replaced with
       something that looks like content. */
    error: '',
    feed: null,
    activeId: '',
    libProp: 'all',
    libKind: 'all',
    toast: '',
  };

  componentDidMount() {
    void this.loadFeed();
  }

  componentWillUnmount() {
    clearTimeout(this._toast);
  }

  async loadFeed() {
    this.setState({ loading: true, error: '' });
    try {
      const feed = await loadDealerMarketingFeed();
      const first = (feed.creatives || [])[0];
      this.setState({
        feed, loading: false,
        activeId: this.state.activeId || (first ? first.id : ''),
      });
    } catch (error) {
      this.setState({
        loading: false, feed: null,
        error: error instanceof Error && error.message
          ? error.message
          : 'Your marketing workspace could not be loaded.',
      });
    }
  }

  say(message) {
    clearTimeout(this._toast);
    this.setState({ toast: message });
    this._toast = setTimeout(() => this.setState({ toast: '' }), 3200);
  }

  /* ── canonical reads ──────────────────────────────────────────── */

  creatives() {
    return (this.state.feed && this.state.feed.creatives) || [];
  }

  posts() { return this.creatives().filter(c => c.creativeType !== 'reel'); }
  reels() { return this.creatives().filter(c => c.creativeType === 'reel'); }

  sectionList() {
    return this.state.section === 'reels' ? this.reels() : this.posts();
  }

  activeCreative() {
    const list = this.sectionList();
    if (!list.length) return null;
    return list.find(c => c.id === this.state.activeId) || list[0];
  }

  connectionFor(channel) {
    const connections = (this.state.feed && this.state.feed.connections) || [];
    return connections.find(c => c.provider === channel);
  }

  /* ── the only thing this screen may say about publishing ─────── */

  /**
   * What is genuinely true of one channel for one creative, in the
   * platform's own terms. A creative that has really been posted says so
   * because a publication row says so — never because this screen
   * decided to.
   */
  channelState(creative, channel) {
    /* 'succeeded' is the word marketing_publications.status actually uses;
       its check constraint allows attempted / succeeded / failed and nothing
       else. Looking for 'published' here meant a creative that really had
       gone out would still have read as not posted. */
    const publication = (creative.publicationStates || [])
      .find(state => state.channel === channel);
    if (publication && publication.status === 'succeeded') {
      return { state: 'published', line: 'Posted', action: publication.publishedAt || '' };
    }
    if (publication && publication.status === 'failed') {
      return { state: 'failed', line: 'Last attempt failed', action: 'MAPCO is looking at it' };
    }
    if (publication && publication.status === 'attempted') {
      return { state: 'attempted', line: 'Sending', action: 'Waiting for the platform to confirm' };
    }
    const connection = this.connectionFor(channel);
    return displayFor(
      channel,
      capabilitiesFor(channel),
      connection
        ? { dealerId: this.state.feed.dealerId, channel, status: connection.status,
            credentialRef: 'stored', displayName: connection.displayName }
        : undefined,
      undefined,
      CHANNEL_LABEL[channel] || channel,
    );
  }

  /**
   * Publishing is not connected, and this is where that is said out loud.
   *
   * The adapters refuse by construction until a provider credential
   * exists, so there is nothing here to "try". Reporting a success would
   * leave a dealer believing a property is being advertised when no
   * platform has ever heard of it.
   */
  publishActive() {
    const creative = this.activeCreative();
    if (!creative) return;
    if (!publishingEnabled()) {
      this.say('Publishing not connected. MAPCO posts this for you once your Instagram, Facebook or WhatsApp Business account is connected — nothing is posted automatically before that.');
      return;
    }
    /* When credentials do arrive this is the single place that asks an
       adapter to publish, and the answer it gives is the answer shown. */
    void this.requestPublish(creative);
  }

  async requestPublish(creative) {
    if (this._publishing) return;      // single-flight: a second click is not a second post
    this._publishing = creative.id;
    try {
      for (const channel of creative.channels || []) {
        const adapter = adapterFor(channel);
        if (!adapter) continue;
        const result = await adapter.publish({ creative, channel });
        if (!result || result.state !== 'published') {
          this.say(`${CHANNEL_LABEL[channel] || channel}: ${(result && result.message) || 'not published'}`);
          return;
        }
      }
      await this.loadFeed();
    } catch (error) {
      this.say(error instanceof Error ? error.message : 'That could not be published.');
    } finally {
      this._publishing = null;
    }
  }

  /* ── presentation helpers ─────────────────────────────────────── */

  dateLabel(iso) {
    if (!iso) return '';
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return '';
    const today = new Date();
    const sameDay = at.toDateString() === today.toDateString();
    if (sameDay) return 'Today';
    const yesterday = new Date(today.getTime() - 864e5);
    if (at.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return `${DAY[at.getDay()]} ${at.getDate()} ${MONTH[at.getMonth()]}`;
  }

  pick(id) { this.setState({ activeId: id }); }

  step(delta) {
    const list = this.sectionList();
    if (list.length < 2) return;
    const at = Math.max(0, list.findIndex(c => c.id === (this.activeCreative() || {}).id));
    const next = (at + delta + list.length) % list.length;
    this.setState({ activeId: list[next].id });
  }

  go(section) {
    const list = section === 'reels' ? this.reels() : this.posts();
    this.setState({ section, activeId: list[0] ? list[0].id : '' });
  }

  renderVals() {
    const s = this.state;
    const feed = s.feed;
    const creatives = this.creatives();
    const emptyLibraryLine = 'MAPCO’s marketing team produces your posts and reels from the'
      + ' properties on your Desk. As soon as one is ready for you it appears here — with'
      + ' the caption, the property it is for and where it will go.';
    const creative = this.activeCreative();
    const active = creative;
    /* An absent caption is said out loud. A blank space reads as a design
       choice, and inventing one would put words in the dealer's mouth. */
    const captionLine = creative
      ? creative.caption || 'No caption was supplied with this creative.'
      : '';

    const tabs = TABS.map(t => ({
      label: t.label, icon: t.icon, go: () => this.go(t.id),
      style: `display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 16px;border-radius:13px;font-size:14.5px;font-weight:800;transition:all .16s;${
        s.section === t.id
          ? 'background:#7a2fe0;color:#fff;box-shadow:0 10px 22px -12px rgba(122,47,224,.8)'
          : 'background:transparent;color:#6b5f80'}`,
    }));

    /* The account chips in the header say what is connected. With nothing
       connected they are grey, which is the truth for a new dealer. */
    const navAccounts = CHANNELS.map(c => {
      const connection = this.connectionFor(c.id);
      const live = connection && connection.status === 'connected';
      return {
        icon: c.icon, color: live ? c.color : '#b9aec9',
        title: live ? `${c.short} connected` : `${c.short} not connected`,
        style: `width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:${live ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.45)'};border:1px solid ${live ? 'rgba(122,47,224,.18)' : 'rgba(122,47,224,.08)'}`,
      };
    });

    const channelRows = active ? CHANNELS.map(c => {
      const state = this.channelState(active, c.id);
      const posted = state.state === 'published';
      return {
        label: c.short, icon: c.icon, color: c.color,
        line: state.line, note: state.action || '',
        style: `display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:14px;background:${posted ? '#e8f8ee' : '#faf6ff'};border:1px solid ${posted ? 'rgba(30,158,69,.28)' : 'rgba(122,47,224,.14)'}`,
        badgeStyle: `font-size:12px;font-weight:800;letter-spacing:.04em;padding:4px 10px;border-radius:999px;${posted ? 'background:#1e9e45;color:#fff' : 'background:#efe8fb;color:#6b3fd4'}`,
      };
    }) : [];

    const libraryProps = [...new Set(creatives.map(c => c.propertyLabel).filter(Boolean))];
    const library = creatives.filter(c => {
      if (s.libKind !== 'all' && (s.libKind === 'reel') !== (c.creativeType === 'reel')) return false;
      if (s.libProp !== 'all' && c.propertyLabel !== s.libProp) return false;
      return true;
    }).map(c => ({
      id: c.id, title: c.propertyLabel || 'Property', when: this.dateLabel(c.readyAt || c.localDate),
      kind: c.creativeType === 'reel' ? 'Reel' : 'Post',
      thumbStyle: `height:168px;border-radius:14px 14px 0 0;background-image:url("${c.displayUrl}");background-size:cover;background-position:center;background-color:#ede4fb`,
      style: 'border-radius:16px;overflow:hidden;background:#fff;border:1px solid rgba(122,47,224,.14);box-shadow:0 18px 36px -28px rgba(60,30,90,.6)',
      go: () => this.setState({ section: c.creativeType === 'reel' ? 'reels' : 'today', activeId: c.id }),
    }));

    const usage = feed && feed.usage;
    const performance = (feed && feed.performance) || [];

    return {
      tabs, navAccounts,
      contentStyle: 'flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column',

      isToday: s.section === 'today', isReels: s.section === 'reels',
      isLibrary: s.section === 'library', isPerformance: s.section === 'performance',

      loading: s.loading, loadError: s.error,
      retry: () => void this.loadFeed(),

      /* The honest empty state. A dealer who has just signed up has no
         creatives, and saying so is more useful than a screen of samples. */
      hasCreatives: creatives.length > 0,
      emptyTitle: s.section === 'reels' ? 'No reels yet' : 'No posts yet',
      emptyLine: emptyLibraryLine,

      active: active ? {
        id: active.id,
        kindLabel: active.creativeType === 'reel' ? 'Reel' : 'Post',
        property: active.propertyLabel || 'Your property',
        when: this.dateLabel(active.readyAt || active.localDate),
        caption: captionLine,
        hasCaption: !!active.caption,
        isReel: active.creativeType === 'reel',
        mediaStyle: `position:relative;width:100%;aspect-ratio:4/5;border-radius:22px;overflow:hidden;background-image:url("${active.displayUrl}");background-size:cover;background-position:center;background-color:#ede4fb;box-shadow:0 44px 80px -40px rgba(40,15,70,.7)`,
        durationLabel: active.durationSeconds
          ? `${Math.floor(active.durationSeconds / 60)}:${String(Math.round(active.durationSeconds % 60)).padStart(2, '0')}`
          : '',
      } : null,
      channelRows,
      countLabel: (() => {
        const list = this.sectionList();
        if (!list.length) return '';
        const at = Math.max(0, list.findIndex(c => c.id === (active || {}).id)) + 1;
        return `${at} of ${list.length}`;
      })(),
      goPrev: () => this.step(-1), goNext: () => this.step(1),
      canStep: this.sectionList().length > 1,

      publish: () => this.publishActive(),
      publishLabel: publishingEnabled() ? 'Publish now' : 'Publishing not connected',
      publishBtnStyle: `display:inline-flex;align-items:center;justify-content:center;gap:9px;height:52px;padding:0 24px;border-radius:15px;font-size:16.5px;font-weight:800;width:100%;${
        publishingEnabled()
          ? 'background:#7a2fe0;color:#fff;box-shadow:0 16px 30px -18px rgba(122,47,224,.9)'
          : 'background:#efe8fb;color:#6b3fd4;border:1px dashed rgba(122,47,224,.4);cursor:not-allowed'}`,
      /* Said on the screen, not only in a toast: a dealer must never think
         MAPCO is posting for them when no account is connected. */
      publishNote: publishingEnabled()
        ? 'MAPCO posts this for you.'
        : 'Only publish when provider credential and connector report success. Your Instagram, Facebook or WhatsApp Business account is not connected yet, so nothing is posted automatically.',

      quotaLabel: usage
        ? `${usage.postsUsed} of ${usage.postsEntitled} posts · ${usage.reelsUsed} of ${usage.reelsEntitled} reels this month`
        : '',
      hasQuota: !!usage,

      libraryProps: ['all', ...libraryProps].map(p => ({
        label: p === 'all' ? 'All properties' : p,
        go: () => this.setState({ libProp: p }),
        style: `height:36px;padding:0 14px;border-radius:11px;font-size:13.5px;font-weight:800;${s.libProp === p ? 'background:#7a2fe0;color:#fff' : 'background:#fff;color:#6b5f80;border:1px solid rgba(122,47,224,.16)'}`,
      })),
      libraryKinds: [['all', 'Everything'], ['post', 'Posts'], ['reel', 'Reels']].map(([id, label]) => ({
        label, go: () => this.setState({ libKind: id }),
        style: `height:36px;padding:0 14px;border-radius:11px;font-size:13.5px;font-weight:800;${s.libKind === id ? 'background:#241833;color:#fff' : 'background:#fff;color:#6b5f80;border:1px solid rgba(122,47,224,.16)'}`,
      })),
      library, libCount: library.length,
      /* "Nothing matches that filter" is wrong for a dealer who has no
         creatives at all — it blames a filter for an empty library. */
      libEmptyLine: creatives.length === 0 ? emptyLibraryLine : 'Nothing matches that filter.',

      /* Nothing invented: a number appears only when a platform reported
         it. Until an account is connected there is nothing to report. */
      performance: performance.map(row => ({
        provider: CHANNEL_LABEL[row.provider] || row.provider,
        scope: row.scope, period: `${row.periodStart} – ${row.periodEnd}`,
        metrics: Object.entries(row.metrics).map(([name, value]) => ({ name, value: String(value) })),
      })),
      hasPerformance: performance.length > 0,
      noMetricsLine: 'No verified platform metrics yet. Reach and engagement appear here once an account is connected and a post has actually run.',

      toast: s.toast,
    };
  }
}
