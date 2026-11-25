// ============================================================
// OAUTH MODEL  — data + API access for Google / GitHub sign-in
// (no DOM access here; see mvc/controllers/oauth-controller.js)
// Depends on AUTH_API from app.js.
// ============================================================
const OAUTH_API = `${AUTH_API}/oauth2`;

const oauthModel = {

    providers: {
        google: { label: 'Google' },
        github: { label: 'GitHub' },
    },

    /** Providers the backend has credentials for, e.g. ['google', 'github']. */
    async fetchEnabledProviders() {
        try {
            const res = await fetch(`${OAUTH_API}/providers`);
            if (!res.ok) return [];
            const data = await res.json();
            return (data.providers || []).filter(p => p in this.providers);
        } catch {
            return []; // backend offline: just hide the social buttons
        }
    },

    /** Absolute URL of the callback view, next to the current page. */
    callbackUrl() {
        return new URL('oauth-callback.html', window.location.href.split('#')[0].split('?')[0]).href;
    },

    /** Backend URL that starts the provider redirect. role: 'player' | 'manager'. */
    authorizeUrl(provider, role) {
        const params = new URLSearchParams({
            redirect_uri: this.callbackUrl(),
            role: role === 'manager' ? 'MANAGER' : 'PLAYER',
        });
        return `${OAUTH_API}/authorize/${encodeURIComponent(provider)}?${params}`;
    },

    /** Reads the result the backend put in the URL fragment (#token=... or #error=...). */
    parseCallback(hash) {
        const params = new URLSearchParams((hash || '').replace(/^#/, ''));
        if (params.get('error')) return { ok: false, error: params.get('error') };
        if (!params.get('token')) return { ok: false, error: 'missing_token' };
        return {
            ok: true,
            data: {
                token:         params.get('token'),
                expiresIn:     params.get('expiresIn') || '0',
                role:          params.get('role'),
                playerID:      params.get('playerID') || '',
                name:          params.get('name') || '',
                email:         params.get('email') || '',
                accountStatus: params.get('accountStatus') || 'Active',
                provider:      params.get('provider') || '',
            },
        };
    },

    /** Stores the session exactly like password login does; returns 'admin' | 'manager' | 'player'. */
    saveSession(data) {
        const role = data.role === 'ADMIN' ? 'admin' : (data.role === 'MANAGER' ? 'manager' : 'player');
        localStorage.setItem('playerEmail',   data.email);
        localStorage.setItem('playerID',      data.playerID);
        localStorage.setItem('playerName',    data.name);
        localStorage.setItem('accountStatus', data.accountStatus);
        localStorage.setItem('jwtToken',      data.token);
        localStorage.setItem('jwtExpiresIn',  data.expiresIn);
        localStorage.setItem('authProvider',  data.provider);
        localStorage.setItem('userRole',      role);
        localStorage.setItem('lastActivity',  String(Date.now()));
        return role;
    },

    /** Human label for ProfileResponse.authProvider. */
    signInMethodLabel(authProvider) {
        return ({ GOOGLE: 'Google', GITHUB: 'GitHub' })[authProvider] || 'Email & password';
    },

    homePageFor(role) {
        if (role === 'admin')   return 'admin.html';
        if (role === 'manager') return 'facility-manager.html';
        return 'dashboard.html';
    },

    errorMessage(code) {
        if (code && code.startsWith('ROLE_MISMATCH:')) {
            const actual = code.split(':')[1] === 'MANAGER' ? 'an Arena Manager' : 'a Player';
            return `This account is registered as ${actual}. Switch the role tab and try again.`;
        }
        return ({
            access_denied:             'Sign-in was cancelled.',
            EMAIL_NOT_VERIFIED:        'Your email address is not verified with this provider. Verify it there, or sign in with your password.',
            email_not_available:       'The provider did not share your email address. Make sure your account has a verified email.',
            ACCOUNT_PENDING_DELETION:  'This account is scheduled for deletion. Login is blocked. Contact admin.playfair@gmail.com to cancel.',
            ADMIN_OAUTH_NOT_SUPPORTED: 'The admin account must sign in with email and password.',
            authorization_request_not_found: 'Your sign-in session expired. Please try again.',
            missing_token:             'Sign-in did not complete. Please try again.',
        })[code] || 'Social sign-in failed. Please try again.';
    },
};
