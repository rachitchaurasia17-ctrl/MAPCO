import '../../packages/ui/tokens.css';
import '../../packages/ui/reset.css';
import './founder.css';
import { hasPlatformAdminAccess, requireSession, signOut } from '../../packages/data/session';
import { founderRepository } from './repository';
import { mountFounderControl } from './view';

const app = document.getElementById('app');
if (app) void requireSession(app, async () => {
  try {
    if (!await founderRepository.bootstrap() || !await hasPlatformAdminAccess()) {
      app.innerHTML = '<main class="fc"><section><h1>Founder access required</h1><p>This private workspace is restricted to the nominated founder.</p><button id="founder-signout">Sign out</button></section></main>';
      app.querySelector('#founder-signout')?.addEventListener('click', () => void signOut());
      return;
    }
    await mountFounderControl(app, founderRepository, signOut);
  } catch (error) {
    app.innerHTML = '<main class="fc"><section><h1>Founder Control could not open</h1><p role="alert"></p><button id="founder-retry">Retry</button><a href="/admin/owner.html">Dealer home</a></section></main>';
    app.querySelector('[role="alert"]')!.textContent = error instanceof Error ? error.message : 'Check your connection and try again.';
    app.querySelector('#founder-retry')?.addEventListener('click', () => location.reload());
  }
});
