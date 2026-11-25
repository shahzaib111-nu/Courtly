// ============================================================
// OAUTH CONTROLLER  — connects oauthModel to the views
//   index.html          → shows "Continue with Google / GitHub" buttons
//   oauth-callback.html → finishes sign-in and routes to the right dashboard
// ============================================================
const oauthController = {

    /** index.html: reveal a button (login + register forms) for every provider the backend has enabled. */
    async initLoginButtons() {
        const sections = document.querySelectorAll('.oauth-section');
        if (sections.length === 0) return;

        const enabled = await oauthModel.fetchEnabledProviders();
        if (enabled.length === 0) return; // stay hidden

        document.querySelectorAll('[data-oauth-provider]').forEach(btn => {
            const provider = btn.dataset.oauthProvider;
            if (!enabled.includes(provider)) return;
            btn.classList.remove('hidden');
            btn.addEventListener('click', () => this.start(provider, btn));
        });
        sections.forEach(section => section.classList.remove('hidden'));
    },

    start(provider, btn) {
        const role = (typeof uiController !== 'undefined' && uiController._role) || 'player';
        if (btn) {
            btn.disabled = true;
            btn.querySelector('[data-label]').textContent = `Redirecting to ${oauthModel.providers[provider].label}…`;
        }
        window.location.href = oauthModel.authorizeUrl(provider, role);
    },

    /** oauth-callback.html: store the JWT session or show the error. */
    handleCallback() {
        const result = oauthModel.parseCallback(window.location.hash);
        // Remove the token from the address bar and browser history.
        history.replaceState(null, '', window.location.pathname);

        if (!result.ok) {
            this._showError(oauthModel.errorMessage(result.error));
            return;
        }
        const role = oauthModel.saveSession(result.data);
        document.getElementById('oauthStatus').textContent = `Welcome, ${result.data.name || 'back'}! Redirecting…`;
        setTimeout(() => { window.location.href = oauthModel.homePageFor(role); }, 600);
    },

    _showError(message) {
        document.getElementById('oauthSpinner')?.classList.add('hidden');
        document.getElementById('oauthStatus').textContent = 'Sign-in failed';
        document.getElementById('oauthErrorText').textContent = message;
        document.getElementById('oauthError').classList.remove('hidden');
    },
};

if (document.querySelector('.oauth-section')) oauthController.initLoginButtons();
if (document.getElementById('oauthCallback')) oauthController.handleCallback();
