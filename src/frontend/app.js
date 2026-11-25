// Single place to point the frontend at the backend (must match server.port in application.properties)
const API_BASE    = 'http://localhost:8081';
const AUTH_API    = `${API_BASE}/api/auth`;
const BOOKING_API = `${API_BASE}/api/bookings`;
const COURT_API   = `${API_BASE}/api/courts`;
const NOTIF_API   = `${API_BASE}/api/notifications`;
const MATCH_API   = `${API_BASE}/api/matches`;
const RATING_API  = `${API_BASE}/api/ratings`;

// JWT transport: attach the bearer token to every API request.
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
    const token = localStorage.getItem('jwtToken');
    if (!token) return originalFetch(input, init);
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    return originalFetch(input, { ...init, headers });
};

// ── Session timeout (UC-05) ─────────────────────────────────────────────────
// Stamp activity on every meaningful user action. The interval checks every
// minute and auto-logs out after 30 minutes of inactivity.
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
function stampActivity() { localStorage.setItem('lastActivity', String(Date.now())); }
(function initSessionWatchdog() {
    if (!localStorage.getItem('playerID')) return; // only for authenticated users
    stampActivity(); // treat page load as activity
    ['click', 'keydown', 'scroll', 'mousemove'].forEach(evt =>
        document.addEventListener(evt, stampActivity, { passive: true }));
    setInterval(() => {
        if (!localStorage.getItem('playerID')) return;
        const last = parseInt(localStorage.getItem('lastActivity') || '0', 10);
        if (Date.now() - last > SESSION_TIMEOUT_MS) {
            localStorage.clear();
            showSessionExpiredBanner();
        }
    }, 60_000);
})();

// Returns today's date as YYYY-MM-DD using LOCAL timezone (not UTC).
// new Date().toISOString() returns UTC which is a day behind in UTC+5 timezones.
function localDateStr(d = new Date()) {
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

// ============================================================
// STYLED OVERLAY DIALOGS (replaces all alert / confirm)
// ============================================================
function showPopup(msg) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm';
    overlay.innerHTML = `
        <div class="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl max-w-sm w-full p-6 relative">
            <button onclick="this.closest('.fixed').remove()" class="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition text-lg leading-none">×</button>
            <p class="text-white text-sm leading-relaxed pr-6">${msg}</p>
            <button onclick="this.closest('.fixed').remove()" class="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-2.5 rounded-xl transition">OK</button>
        </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
}

function showConfirm(msg, onConfirm, confirmLabel = 'Delete', confirmClass = 'bg-red-600 hover:bg-red-500') {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm';
    overlay.innerHTML = `
        <div class="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl max-w-sm w-full p-6 relative">
            <button onclick="this.closest('.fixed').remove()" class="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition text-lg leading-none">×</button>
            <p class="text-white text-sm leading-relaxed pr-6">${msg}</p>
            <div class="flex gap-3 mt-5">
                <button id="_popup-no"  class="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold py-2.5 rounded-xl transition">Cancel</button>
                <button id="_popup-yes" class="flex-1 ${confirmClass} text-white text-sm font-semibold py-2.5 rounded-xl transition">${confirmLabel}</button>
            </div>
        </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#_popup-no').addEventListener('click',  () => overlay.remove());
    overlay.querySelector('#_popup-yes').addEventListener('click', () => { overlay.remove(); onConfirm(); });
    document.body.appendChild(overlay);
}

function showSessionExpiredBanner() {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm';
    overlay.innerHTML = `
        <div class="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div class="flex items-center gap-3 mb-3">
                <span class="text-2xl">⏱</span>
                <p class="text-white font-semibold text-base">Session Expired</p>
            </div>
            <p class="text-slate-400 text-sm leading-relaxed">Your session timed out due to inactivity. Please sign in again to continue.</p>
            <button onclick="window.location.href='index.html'" class="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-2.5 rounded-xl transition">Sign In Again</button>
        </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => { window.location.href = 'index.html'; }, 8000);
}

// ============================================================
// PASSWORD VISIBILITY TOGGLE
// ============================================================
function togglePw(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.querySelector('svg').innerHTML = show
        ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21"/>`
        : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>`;
}

// ============================================================
// PAGE GUARD — enforce role-based access
// ============================================================
(function () {
    const role = localStorage.getItem('userRole');
    const path = window.location.pathname;
    const isProtected = path.endsWith('dashboard.html') || path.endsWith('facility-manager.html');
    if (isProtected && !role) { window.location.href = 'index.html'; return; }
    if (path.endsWith('dashboard.html')        && role !== 'player')  { window.location.href = 'index.html'; return; }
    if (path.endsWith('facility-manager.html') && role !== 'manager') { window.location.href = 'index.html'; }
})();

function logout() {
    localStorage.removeItem('userRole');
    localStorage.removeItem('playerName');
    localStorage.removeItem('playerID');
    localStorage.removeItem('playerEmail');
    localStorage.removeItem('accountStatus');
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('jwtExpiresIn');
    localStorage.removeItem('authProvider');
    window.location.href = 'index.html';
}

function toDisplayName(raw) {
    return raw.replace(/[._+-]/g, ' ')
              .split(' ')
              .filter(Boolean)
              .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ');
}

// ============================================================
// INLINE ERROR HELPERS
// ============================================================
function showFieldError(fieldId, msg) {
    const errEl   = document.getElementById(`err-${fieldId}`);
    const inputEl = document.getElementById(fieldId);
    if (errEl)   { errEl.textContent = `⚠ ${msg}`; errEl.classList.remove('hidden'); }
    if (inputEl) { inputEl.classList.add('border-rose-500'); inputEl.classList.remove('border-slate-600'); }
}

function clearFieldError(fieldId) {
    const errEl   = document.getElementById(`err-${fieldId}`);
    const inputEl = document.getElementById(fieldId);
    if (errEl)   { errEl.textContent = ''; errEl.classList.add('hidden'); }
    if (inputEl) { inputEl.classList.remove('border-rose-500'); inputEl.classList.add('border-slate-600'); }
}

function showFormError(formType, msg) {
    const banner = document.getElementById(`${formType}FormError`);
    const text   = document.getElementById(`${formType}FormErrorText`);
    if (banner && text) { text.textContent = msg; banner.classList.remove('hidden'); }
}

function clearFormError(formType) {
    const banner = document.getElementById(`${formType}FormError`);
    if (banner) banner.classList.add('hidden');
}

// ============================================================
// CLIENT-SIDE VALIDATION
// ============================================================
function validateLoginForm() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass  = document.getElementById('loginPass').value;
    let valid = true;

    clearFieldError('loginEmail');
    clearFieldError('loginPass');

    if (!email) {
        showFieldError('loginEmail', 'Email address is required.');
        valid = false;
    }
    if (!pass) {
        showFieldError('loginPass', 'Password is required.');
        valid = false;
    } else if (pass.length < 8) {
        showFieldError('loginPass', 'Password must be at least 8 characters.');
        valid = false;
    }
    return valid;
}

function validateRegisterForm() {
    const name  = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const dob   = document.getElementById('regDob').value;
    const pass  = document.getElementById('regPass').value;
    let valid = true;

    ['regName', 'regEmail', 'regPhone', 'regDob', 'regPass'].forEach(clearFieldError);

    if (!name || !/^[a-zA-Z\s]{2,}$/.test(name)) {
        showFieldError('regName', 'Enter your full name using letters only (min 2 characters).');
        valid = false;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFieldError('regEmail', 'Enter a valid email address.');
        valid = false;
    }

    if (!phone || !/^[+\d][\d\s\-()+]{6,17}$/.test(phone)) {
        showFieldError('regPhone', 'Enter a valid phone number. Use digits, +, spaces, or dashes only.');
        valid = false;
    }

    if (!dob) {
        showFieldError('regDob', 'Date of birth is required.');
        valid = false;
    } else {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const birth = new Date(dob);
        const ageYears = (today - birth) / (365.25 * 24 * 60 * 60 * 1000);
        if (birth >= today) {
            showFieldError('regDob', 'Date of birth cannot be today or in the future.');
            valid = false;
        } else if (ageYears < 5) {
            showFieldError('regDob', 'You must be at least 5 years old to register.');
            valid = false;
        } else if (ageYears > 120) {
            showFieldError('regDob', 'Please enter a valid date of birth.');
            valid = false;
        }
    }

    if (pass.length < 8) {
        showFieldError('regPass', 'Password must be at least 8 characters.');
        valid = false;
    }

    return valid;
}

// ============================================================
// AUTH CONTROLLER  (index.html — login / register / reset)
// ============================================================
const uiController = {

    _role: localStorage.getItem('pendingRole') || 'player',
    _otpEmail: '',
    _otpCode:  '',

    setRole(role) {
        this._role = role;
        localStorage.setItem('pendingRole', role);

        const playerBtn  = document.getElementById('role-player');
        const managerBtn = document.getElementById('role-manager');
        if (playerBtn && managerBtn) {
            const ACTIVE_PLAYER  = 'group py-5 px-4 flex flex-col items-center gap-1 transition-all bg-indigo-600/20 border-b-2 border-indigo-500';
            const ACTIVE_MANAGER = 'group py-5 px-4 flex flex-col items-center gap-1 transition-all bg-emerald-600/20 border-b-2 border-emerald-500';
            const INACTIVE       = 'group py-5 px-4 flex flex-col items-center gap-1 transition-all border-b-2 border-transparent hover:bg-white/5';
            playerBtn.className  = role === 'player'  ? ACTIVE_PLAYER  : INACTIVE;
            managerBtn.className = role === 'manager' ? ACTIVE_MANAGER : INACTIVE;

            playerBtn.querySelector('span:nth-child(2)').className  = role === 'player'  ? 'text-sm font-bold text-white' : 'text-sm font-bold text-slate-400 group-hover:text-white transition-colors';
            managerBtn.querySelector('span:nth-child(2)').className = role === 'manager' ? 'text-sm font-bold text-white' : 'text-sm font-bold text-slate-400 group-hover:text-white transition-colors';
        }

        const subtitle     = document.getElementById('formSubtitle');
        const registerForm = document.getElementById('registerForm');
        if (subtitle) {
            const isRegister = registerForm && !registerForm.classList.contains('hidden');
            if (role === 'player') {
                subtitle.textContent = isRegister ? 'Create your Player account' : 'Sign in as Player';
            } else {
                subtitle.textContent = isRegister ? 'Create your Arena Manager account' : 'Sign in as Arena Manager';
            }
        }

        const loginBtn = document.getElementById('loginSubmitBtn');
        const regBtn   = document.getElementById('registerSubmitBtn');
        const BASE = 'w-full text-white font-bold py-3 rounded-xl transition-all mt-2';
        if (role === 'player') {
            if (loginBtn) loginBtn.className = `${BASE} bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_24px_rgba(99,102,241,0.35)]`;
            if (regBtn)   regBtn.className   = `${BASE} bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_24px_rgba(99,102,241,0.35)]`;
        } else {
            if (loginBtn) loginBtn.className = `${BASE} bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.35)]`;
            if (regBtn)   regBtn.className   = `${BASE} bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.35)]`;
        }
    },

    render(view) {
        const loginForm    = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const resetForm    = document.getElementById('resetForm');
        const roleHeader   = document.getElementById('roleSelectorHeader');

        loginForm?.classList.add('hidden');
        registerForm?.classList.add('hidden');
        resetForm?.classList.add('hidden');

        if (view === 'reset') {
            roleHeader?.classList.add('hidden');
            resetForm?.classList.remove('hidden');
            const sub = document.getElementById('formSubtitle');
            if (sub) sub.textContent = 'Reset Your Password';
            // Reset OTP state and show step 1
            this._otpEmail = '';
            this._otpCode  = '';
            const s1 = document.getElementById('otpStep1');
            const s2 = document.getElementById('otpStep2');
            const s3 = document.getElementById('otpStep3');
            if (s1) s1.classList.remove('hidden');
            if (s2) s2.classList.add('hidden');
            if (s3) s3.classList.add('hidden');
            const emailEl = document.getElementById('resetEmail');
            if (emailEl) emailEl.value = '';
            clearFieldError('resetEmail');
            const errBanner = document.getElementById('otpErrorBanner');
            if (errBanner) errBanner.classList.add('hidden');
            return;
        }

        roleHeader?.classList.remove('hidden');
        if (view === 'login') {
            loginForm?.classList.remove('hidden');
        } else {
            registerForm?.classList.remove('hidden');
        }
        this.setRole(this._role);
    },

    async captureCredentials(action, event) {
        event.preventDefault();
        const btn      = event.target.querySelector('button[type="submit"]');
        const original = btn.textContent;

        if (action === 'login') {
            clearFormError('login');
            if (!validateLoginForm()) return;
        } else {
            clearFormError('register');
            if (!validateRegisterForm()) return;
        }

        btn.textContent = action === 'login' ? 'Signing in…' : 'Creating account…';
        btn.disabled = true;
        let finalRole = this._role;

        try {
            if (action === 'login') {
                const email        = document.getElementById('loginEmail').value.trim();
                const pass         = document.getElementById('loginPass').value;
                const requestedRole = this._role === 'manager' ? 'MANAGER' : 'PLAYER';
                let res, data;
                try {
                    res  = await fetch(`${AUTH_API}/login?email=${encodeURIComponent(email)}&pass=${encodeURIComponent(pass)}&role=${requestedRole}`, { method: 'POST' });
                    data = await res.json();
                } catch {
                    throw new Error(`Cannot connect to server. Make sure the backend is running at ${API_BASE}.`);
                }
                if (!res.ok) {
                    if (data.message === 'ACCOUNT_PENDING_DELETION') {
                        showFormError('login', 'This account is scheduled for deletion. Login is blocked. Contact admin.playfair@gmail.com to cancel.');
                    } else if (data.message === 'EMAIL_NOT_FOUND') {
                        showFormError('login', 'No account found. Please register first.');
                    } else if (typeof data.message === 'string' && data.message.startsWith('ROLE_MISMATCH:')) {
                        showFormError('login', 'No account found. Please register first.');
                    } else {
                        showFormError('login', 'Incorrect email or password. Please try again.');
                    }
                    btn.textContent = original; btn.disabled = false;
                    return;
                }
                localStorage.setItem('playerEmail',    email);
                localStorage.setItem('playerID',       data.playerID     || '');
                localStorage.setItem('playerName',     data.name         || '');
                localStorage.setItem('accountStatus',  data.accountStatus || 'Active');
                finalRole = data.role === 'ADMIN' ? 'admin' : (data.role === 'MANAGER' ? 'manager' : 'player');
                if (data.token) {
                    localStorage.setItem('jwtToken', data.token);
                    localStorage.setItem('jwtExpiresIn', String(data.expiresIn || 0));
                }

            } else {
                const userData = {
                    name:         document.getElementById('regName').value.trim(),
                    email:        document.getElementById('regEmail').value.trim(),
                    passwordHash: document.getElementById('regPass').value,
                    phone:        document.getElementById('regPhone').value.trim(),
                    dateOfBirth:  document.getElementById('regDob').value,
                    role:         this._role === 'manager' ? 'MANAGER' : 'PLAYER',
                };
                let res, data;
                try {
                    res  = await fetch(`${AUTH_API}/register`, {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify(userData)
                    });
                    data = await res.json();
                } catch {
                    throw new Error(`Cannot connect to server. Make sure the backend is running at ${API_BASE}.`);
                }
                if (!res.ok) {
                    showFormError('register', (typeof data === 'string' ? data : data.error) || 'Registration failed. Please try again.');
                    btn.textContent = original; btn.disabled = false;
                    return;
                }
                localStorage.setItem('playerEmail',   userData.email);
                localStorage.setItem('playerID',     data.userID || '');
                localStorage.setItem('playerName',   data.name   || userData.name);
                localStorage.setItem('accountStatus', data.accountStatus || (this._role === 'manager' ? 'PENDING_APPROVAL' : 'Active'));
                finalRole = this._role === 'manager' ? 'manager' : 'player';
            }

            localStorage.setItem('userRole', finalRole);
            btn.textContent = 'Welcome!';
            setTimeout(() => {
                if (finalRole === 'admin')        window.location.href = 'admin.html';
                else if (finalRole === 'manager') window.location.href = 'facility-manager.html';
                else                              window.location.href = 'dashboard.html';
            }, 600);

        } catch (e) {
            btn.textContent = original; btn.disabled = false;
            showFormError(action === 'login' ? 'login' : 'register', e.message);
        }
    },

    async sendOtp() {
        const emailEl = document.getElementById('resetEmail');
        const email   = emailEl ? emailEl.value.trim() : '';
        clearFieldError('resetEmail');

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showFieldError('resetEmail', 'Enter a valid email address.');
            return;
        }

        const btn = document.getElementById('sendOtpBtn');
        btn.textContent = 'Sending...'; btn.disabled = true;

        try {
            let res, data;
            try {
                res  = await fetch(`${AUTH_API}/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                data = await res.json();
            } catch {
                throw new Error(`Cannot connect to server. Make sure the backend is running at ${API_BASE}.`);
            }
            if (!res.ok) throw new Error(data.error || 'Failed to send OTP. Please try again.');

            this._otpEmail = email;
            const displayEl = document.getElementById('otpEmailDisplay');
            if (displayEl) displayEl.textContent = email;

            document.getElementById('otpStep1').classList.add('hidden');
            document.getElementById('otpStep2').classList.remove('hidden');
            const otpInput = document.getElementById('otpInput');
            if (otpInput) { otpInput.value = ''; otpInput.focus(); }
            const errBanner = document.getElementById('otpErrorBanner');
            if (errBanner) errBanner.classList.add('hidden');
        } catch (e) {
            btn.textContent = 'Send OTP'; btn.disabled = false;
            showFieldError('resetEmail', e.message);
        }
    },

    async verifyOtp() {
        const otp       = (document.getElementById('otpInput')?.value || '').trim();
        const errBanner = document.getElementById('otpErrorBanner');
        const errText   = document.getElementById('otpErrorText');

        if (errBanner) errBanner.classList.add('hidden');

        if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
            if (errBanner && errText) {
                errText.textContent = 'Enter the 6-digit OTP from your email.';
                errBanner.classList.remove('hidden');
            }
            return;
        }

        const btn = document.getElementById('verifyOtpBtn');
        btn.textContent = 'Verifying...'; btn.disabled = true;

        try {
            let res, data;
            try {
                res  = await fetch(`${AUTH_API}/verify-otp`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ email: this._otpEmail, otp })
                });
                data = await res.json();
            } catch {
                throw new Error(`Cannot connect to server. Make sure the backend is running at ${API_BASE}.`);
            }
            if (!res.ok) throw new Error(data.error || 'Invalid OTP. Please check the code and try again.');

            this._otpCode = otp;
            document.getElementById('otpStep2').classList.add('hidden');
            document.getElementById('otpStep3').classList.remove('hidden');
            const npEl = document.getElementById('resetNewPass');
            const cpEl = document.getElementById('resetConfirmPass');
            if (npEl) { npEl.value = ''; }
            if (cpEl) { cpEl.value = ''; }
            clearFieldError('resetNewPass');
            clearFieldError('resetConfirmPass');
        } catch (e) {
            btn.textContent = 'Verify OTP'; btn.disabled = false;
            if (errBanner && errText) {
                errText.textContent = e.message;
                errBanner.classList.remove('hidden');
            }
        }
    },

    async resendOtp() {
        if (!this._otpEmail) return;
        const errBanner = document.getElementById('otpErrorBanner');
        if (errBanner) errBanner.classList.add('hidden');

        const btn = document.getElementById('resendOtpBtn');
        btn.textContent = 'Sending...'; btn.disabled = true;

        try {
            let res, data;
            try {
                res  = await fetch(`${AUTH_API}/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: this._otpEmail })
                });
                data = await res.json();
            } catch {
                throw new Error('Cannot connect to server.');
            }
            if (!res.ok) throw new Error(data.error || 'Failed to resend OTP.');
            const otpInput = document.getElementById('otpInput');
            if (otpInput) otpInput.value = '';
            showPopup('A new OTP has been sent to ' + this._otpEmail);
        } catch (e) {
            showPopup(e.message);
        } finally {
            btn.textContent = 'Resend OTP'; btn.disabled = false;
        }
    },

    async resetWithOtp() {
        const newPass     = document.getElementById('resetNewPass').value;
        const confirmPass = document.getElementById('resetConfirmPass').value;

        clearFieldError('resetNewPass');
        clearFieldError('resetConfirmPass');

        if (newPass.length < 8) {
            showFieldError('resetNewPass', 'Password must be at least 8 characters.');
            return;
        }
        if (newPass !== confirmPass) {
            showFieldError('resetConfirmPass', 'Passwords do not match.');
            return;
        }

        const btn = document.getElementById('resetSubmitBtn');
        btn.textContent = 'Resetting...'; btn.disabled = true;

        try {
            let res, data;
            try {
                res  = await fetch(`${AUTH_API}/reset-password-otp`, {
                    method:  'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ email: this._otpEmail, otp: this._otpCode, newPassword: newPass })
                });
                data = await res.json();
            } catch {
                throw new Error(`Cannot connect to server. Make sure the backend is running at ${API_BASE}.`);
            }
            if (!res.ok) throw new Error(data.error || 'Reset failed. Please try again.');

            btn.textContent = '✓ Password Reset!';
            setTimeout(() => {
                const loginEmailEl = document.getElementById('loginEmail');
                if (loginEmailEl) loginEmailEl.value = this._otpEmail;
                this._otpEmail = '';
                this._otpCode  = '';
                this.render('login');
            }, 1200);
        } catch (e) {
            btn.textContent = 'Reset Password'; btn.disabled = false;
            showFieldError('resetNewPass', e.message);
        }
    }
};

// ============================================================
// CHANGE PASSWORD CONTROLLER  (dashboard.html + facility-manager.html)
// ============================================================
const changePasswordController = {

    // true when the account was created with Google/GitHub and has no password yet
    _setMode: false,

    open() {
        this._setMode = false;
        const existing = document.getElementById('changePwModal');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'changePwModal';
        overlay.className = 'fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm';
        overlay.innerHTML = `
            <div class="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl max-w-sm w-full p-6 relative">
                <button onclick="changePasswordController.close()" class="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition text-lg leading-none">×</button>
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                        <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                        </svg>
                    </div>
                    <div>
                        <h3 id="cpTitle" class="text-white font-bold text-base">Change Password</h3>
                        <p id="cpSubtitle" class="text-xs text-slate-400">Enter your current and new password.</p>
                    </div>
                </div>
                <div id="cpErrorBanner" class="hidden bg-rose-900/40 border border-rose-700/60 text-rose-300 text-sm px-4 py-3 rounded-xl flex items-start gap-2 mb-4">
                    <span class="shrink-0 mt-0.5">⚠</span><span id="cpErrorText"></span>
                </div>
                <div class="space-y-4">
                    <div id="cpCurrentWrap">
                        <label class="text-xs text-slate-400 mb-1.5 block font-medium">Current Password</label>
                        <div class="relative">
                            <input id="cpCurrentPass" type="password" placeholder="Your current password"
                                class="w-full bg-slate-900/60 border border-slate-600 rounded-xl px-4 py-3 pr-11 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition">
                            <button type="button" tabindex="-1" onclick="togglePw('cpCurrentPass', this)"
                                class="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-200 transition">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div>
                        <label class="text-xs text-slate-400 mb-1.5 block font-medium">New Password</label>
                        <div class="relative">
                            <input id="cpNewPass" type="password" placeholder="Minimum 8 characters"
                                class="w-full bg-slate-900/60 border border-slate-600 rounded-xl px-4 py-3 pr-11 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition">
                            <button type="button" tabindex="-1" onclick="togglePw('cpNewPass', this)"
                                class="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-200 transition">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div>
                        <label class="text-xs text-slate-400 mb-1.5 block font-medium">Confirm New Password</label>
                        <div class="relative">
                            <input id="cpConfirmPass" type="password" placeholder="Repeat new password"
                                class="w-full bg-slate-900/60 border border-slate-600 rounded-xl px-4 py-3 pr-11 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition">
                            <button type="button" tabindex="-1" onclick="togglePw('cpConfirmPass', this)"
                                class="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-200 transition">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                <button id="cpSubmitBtn" type="button" onclick="changePasswordController.submit()"
                    class="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-3 rounded-xl transition">
                    Change Password
                </button>
            </div>`;
        overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
        document.body.appendChild(overlay);
        const firstInput = overlay.querySelector('#cpCurrentPass');
        if (firstInput) firstInput.focus();
        this._detectPasswordlessAccount();
    },

    /** Accounts created via Google/GitHub have no password: switch the modal to "Set Password". */
    async _detectPasswordlessAccount() {
        const email = localStorage.getItem('playerEmail');
        if (!email) return;
        try {
            const res = await fetch(`${AUTH_API}/profile?email=${encodeURIComponent(email)}`);
            if (!res.ok) return;
            const profile = await res.json();
            if (profile.hasPassword !== false || !document.getElementById('changePwModal')) return;
            this._setMode = true;
            const provider = profile.authProvider === 'GITHUB' ? 'GitHub' : 'Google';
            document.getElementById('cpTitle').textContent    = 'Set a Password';
            document.getElementById('cpSubtitle').textContent = `You sign in with ${provider}. Add a password to also sign in with your email.`;
            document.getElementById('cpCurrentWrap').classList.add('hidden');
            document.getElementById('cpSubmitBtn').textContent = 'Set Password';
            document.getElementById('cpNewPass')?.focus();
        } catch { /* keep the normal change-password form */ }
    },

    close() {
        const modal = document.getElementById('changePwModal');
        if (modal) modal.remove();
    },

    async submit() {
        const currentPass = (document.getElementById('cpCurrentPass')?.value || '');
        const newPass     = (document.getElementById('cpNewPass')?.value     || '');
        const confirmPass = (document.getElementById('cpConfirmPass')?.value || '');
        const email       = localStorage.getItem('playerEmail') || '';

        const errBanner = document.getElementById('cpErrorBanner');
        const errText   = document.getElementById('cpErrorText');
        if (errBanner) errBanner.classList.add('hidden');

        if (!currentPass && !this._setMode) {
            errText.textContent = 'Current password is required.';
            errBanner.classList.remove('hidden'); return;
        }
        if (newPass.length < 8) {
            errText.textContent = 'New password must be at least 8 characters.';
            errBanner.classList.remove('hidden'); return;
        }
        if (newPass !== confirmPass) {
            errText.textContent = 'New passwords do not match.';
            errBanner.classList.remove('hidden'); return;
        }
        if (!this._setMode && newPass === currentPass) {
            errText.textContent = 'New password must be different from the current password.';
            errBanner.classList.remove('hidden'); return;
        }

        const btn = document.getElementById('cpSubmitBtn');
        const idleLabel = this._setMode ? 'Set Password' : 'Change Password';
        btn.textContent = this._setMode ? 'Saving...' : 'Changing...'; btn.disabled = true;

        try {
            let res, data;
            try {
                res  = await fetch(`${AUTH_API}/change-password`, {
                    method:  'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ email, currentPassword: this._setMode ? null : currentPass, newPassword: newPass })
                });
                data = await res.json();
            } catch {
                throw new Error(`Cannot connect to server. Make sure the backend is running at ${API_BASE}.`);
            }
            if (!res.ok) throw new Error(data.error || 'Failed to change password. Please try again.');

            this.close();
            showPopup(this._setMode
                ? 'Password set! You can now also sign in with your email and password.'
                : 'Password changed successfully! Your new password is active immediately.');
        } catch (e) {
            errText.textContent = e.message;
            errBanner.classList.remove('hidden');
            btn.textContent = idleLabel; btn.disabled = false;
        }
    }
};

// ============================================================
// EVENT LISTENERS  (index.html)
// ============================================================
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit',    e => uiController.captureCredentials('login', e));
    document.getElementById('registerForm').addEventListener('submit', e => uiController.captureCredentials('register', e));
    document.getElementById('resetForm').addEventListener('submit',    e => e.preventDefault());
    uiController.setRole(uiController._role);

    // Set DOB calendar bounds so users can't pick impossible dates
    const dobInput = document.getElementById('regDob');
    if (dobInput) {
        const today = new Date();
        dobInput.setAttribute('max', localDateStr(today));
        const minDate = new Date();
        minDate.setFullYear(minDate.getFullYear() - 120);
        dobInput.setAttribute('min', localDateStr(minDate));
    }

    // Clear field-level errors as the user types
    ['loginEmail', 'loginPass'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => { clearFieldError(id); clearFormError('login'); });
    });
    ['regName', 'regEmail', 'regPhone', 'regDob', 'regPass'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => { clearFieldError(id); clearFormError('register'); });
    });
}

// ============================================================
// DASHBOARD CONTROLLER  (dashboard.html — player view)
// ============================================================
const dashboardController = {

    async searchAvailableSlots() {
        const date      = document.getElementById('searchDate').value;
        const type      = document.getElementById('courtType').value;
        const container = document.getElementById('slotsContainer');
        const today     = localDateStr();

        if (!date) { showPopup('Please select a date first!'); return; }
        if (date < today) {
            container.innerHTML = `<p class="text-rose-400 text-sm col-span-full">Cannot search past dates. Please select today or a future date.</p>`;
            return;
        }

        container.innerHTML = `<p class="text-indigo-400 animate-pulse col-span-full">Searching...</p>`;

        let slots = [];
        try {
            const res = await fetch(`${BOOKING_API}/availability?date=${date}&type=${type}`);
            if (!res.ok) throw new Error('Server error');
            slots = await res.json();
        } catch {
            container.innerHTML = `
            <div class="col-span-full text-center py-8">
                <p class="text-red-400 text-sm font-medium">Could not reach the server.</p>
                <p class="text-slate-500 text-xs mt-1">Make sure the backend is running at ${API_BASE}, then try again.</p>
            </div>`;
            return;
        }

        // For today, strip any slot whose start time has already passed
        if (date === today) {
            const now = new Date();
            slots = slots.filter(s => {
                const [h, m] = (s.timeSlot || '').split('-')[0].split(':').map(Number);
                const slotTime = new Date();
                slotTime.setHours(h, m, 0, 0);
                return slotTime > now;
            });
        }

        container.innerHTML = '';
        if (!slots.length) {
            container.innerHTML = `<p class="text-amber-400 text-sm col-span-full">No available slots found. Try a different date or sport.</p>`;
            return;
        }

        const _dow = new Date(date + 'T00:00:00').getDay();
        const _isWeekend = _dow === 0 || _dow === 6;
        slots.forEach(slot => {
            const _peak = slot.isPeak;
            const _slotBadge = (_peak && _isWeekend)
                ? `<span class="px-1.5 py-0.5 rounded text-xs font-semibold bg-red-600/25 text-red-400">PEAK + WEEKEND</span>`
                : _peak
                ? `<span class="px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-400">PEAK</span>`
                : _isWeekend
                ? `<span class="px-1.5 py-0.5 rounded text-xs font-semibold bg-purple-500/20 text-purple-400">WEEKEND</span>`
                : '';
            const _priceColor = (_peak && _isWeekend) ? 'text-red-400' : _peak ? 'text-amber-400' : _isWeekend ? 'text-purple-400' : 'text-teal-400';
            const card = document.createElement('div');
            card.className = 'bg-slate-900/80 border border-slate-600 p-4 rounded-lg cursor-pointer hover:border-indigo-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all';
            card.innerHTML = `
                <div class="flex justify-between items-start mb-1">
                    <p class="font-bold text-white">${slot.timeSlot}</p>
                    ${_slotBadge}
                </div>
                <p class="text-sm text-slate-400 truncate">${slot.courtName || slot.courtID}</p>
                <p class="text-sm font-semibold mt-2 ${_priceColor}">PKR ${slot.price.toLocaleString()}</p>`;
            card.onclick = () => this.selectSlot(slot.courtID, slot.timeSlot, date, slot.price, slot.isPeak, slot.courtName);
            container.appendChild(card);
        });
    },

    selectSlot(courtId, time, date, price, isPeak, courtName) {
        document.getElementById('bCourtId').value   = courtId;
        document.getElementById('bCourtName').value = courtName || courtId;
        document.getElementById('bDate').value      = date;
        document.getElementById('bIsPeak').value    = isPeak ? '1' : '0';

        const display = document.getElementById('bCourtDisplay');
        display.value = courtName || courtId;
        display.classList.replace('text-slate-500', 'text-white');

        document.getElementById('bTimeSlot').value = time;
        document.getElementById('bTimeSlot').classList.replace('text-slate-500', 'text-white');

        const priceEl = document.getElementById('bPriceDisplay');
        priceEl.value = `PKR ${Number(price).toLocaleString()}`;
        priceEl.classList.remove('text-slate-500', 'text-teal-400', 'text-amber-400');
        priceEl.classList.add(isPeak ? 'text-amber-400' : 'text-teal-400');

        const warn = document.getElementById('peakWarning');
        if (warn) isPeak ? warn.classList.remove('hidden') : warn.classList.add('hidden');

        const btn = document.getElementById('initiateBtn');
        btn.disabled = false;
        btn.classList.replace('bg-slate-700', 'bg-teal-600');
        btn.classList.add('hover:bg-teal-500');

        const bookNowBtn = document.getElementById('bookNowBtn');
        if (bookNowBtn) {
            bookNowBtn.disabled = false;
            bookNowBtn.classList.replace('bg-slate-700', 'bg-indigo-600');
            bookNowBtn.classList.add('hover:bg-indigo-500');
        }
    },

    async bookNowOnly() {
        const courtId   = document.getElementById('bCourtId').value;
        const timeSlot  = document.getElementById('bTimeSlot').value;
        const date      = document.getElementById('bDate').value;
        const btn       = document.getElementById('bookNowBtn');
        const original  = btn.innerHTML;

        // Guard: reject past dates and past time slots
        const today = localDateStr();
        if (date < today) {
            this._showToast('Cannot book a past date.', 'error'); return;
        }
        if (date === today && timeSlot) {
            const [h, m] = timeSlot.split('-')[0].trim().split(':').map(Number);
            const slotTime = new Date(); slotTime.setHours(h, m, 0, 0);
            if (slotTime <= new Date()) {
                this._showToast('This time slot has already passed. Please choose a future slot.', 'error'); return;
            }
        }

        btn.textContent = 'Reserving...'; btn.disabled = true;
        const playerID = localStorage.getItem('playerID') || 'guest';
        try {
            const res = await fetch(BOOKING_API, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ playerID, courtID: courtId, bookingDate: date, timeSlot })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Booking failed');

            this._showToast('Booked! You have 60 minutes to complete payment from My Bookings.');
            this.loadMyBookings();

            // Reset Quick Book panel
            document.getElementById('bCourtDisplay').value = '';
            document.getElementById('bTimeSlot').value     = '';
            document.getElementById('bPriceDisplay').value = '';
            ['bCourtId', 'bCourtName', 'bDate', 'bIsPeak'].forEach(id => document.getElementById(id).value = '');
            const peakWarn = document.getElementById('peakWarning');
            if (peakWarn) peakWarn.classList.add('hidden');

            btn.innerHTML = original; btn.disabled = true;
            btn.classList.replace('bg-indigo-600', 'bg-slate-700');
            btn.classList.remove('hover:bg-indigo-500');

            const payBtn = document.getElementById('initiateBtn');
            payBtn.disabled = true;
            payBtn.classList.replace('bg-teal-600', 'bg-slate-700');
            payBtn.classList.remove('hover:bg-teal-500');

        } catch (err) {
            this._showToast(err.message, 'error');
            btn.innerHTML = original; btn.disabled = false;
        }
    },

    async initiateBooking() {
        const courtId   = document.getElementById('bCourtId').value;
        const timeSlot  = document.getElementById('bTimeSlot').value;
        const date      = document.getElementById('bDate').value;
        const price     = document.getElementById('bPriceDisplay').value.replace('PKR ', '').replace(',', '');
        const isPeak    = document.getElementById('bIsPeak').value === '1';
        const courtName = document.getElementById('bCourtName').value;
        const btn       = document.getElementById('initiateBtn');

        // Guard: reject past dates and past time slots
        const today = localDateStr();
        if (date < today) {
            showPopup('Cannot book a past date. Please search for an upcoming slot.'); return;
        }
        if (date === today && timeSlot) {
            const [h, m] = timeSlot.split('-')[0].trim().split(':').map(Number);
            const slotTime = new Date(); slotTime.setHours(h, m, 0, 0);
            if (slotTime <= new Date()) {
                showPopup('This time slot has already passed. Please search for a future slot.'); return;
            }
        }

        btn.textContent = 'Locking Slot...'; btn.disabled = true;
        const playerID = localStorage.getItem('playerID') || 'guest';
        try {
            const res = await fetch(BOOKING_API, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ playerID, courtID: courtId, bookingDate: date, timeSlot })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Booking failed');

            const bookingID = data.bookingID || '';
            window.location.href = `checkout.html?bookingID=${bookingID}&court=${encodeURIComponent(courtName)}&time=${encodeURIComponent(timeSlot)}&price=${price}&isPeak=${isPeak ? 1 : 0}&date=${encodeURIComponent(date)}`;
        } catch (err) {
            if (err instanceof TypeError) {
                const mockID = 'MOCK-' + Date.now();
                window.location.href = `checkout.html?bookingID=${mockID}&court=${encodeURIComponent(courtName)}&time=${encodeURIComponent(timeSlot)}&price=${price}&isPeak=${isPeak ? 1 : 0}&date=${encodeURIComponent(date)}`;
                return;
            }
            showPopup(err.message);
            btn.textContent = 'Proceed to Checkout'; btn.disabled = false;
        }
    },

    allBookings: [],

    async loadMyBookings() {
        const container = document.getElementById('bookingsContainer');
        if (!container) return;
        container.innerHTML = `<p class="text-indigo-400 animate-pulse text-sm">Loading your bookings...</p>`;
        const playerID = localStorage.getItem('playerID') || 'guest';
        try {
            const res = await fetch(`${BOOKING_API}/player/${encodeURIComponent(playerID)}`);
            if (!res.ok) throw new Error();
            const raw = await res.json();
            this.allBookings = raw.map(b => ({
                ...b,
                date:      b.bookingDate || b.date,
                courtType: b.sportType   || b.courtType,
                status:    (b.status || 'pending').toLowerCase()
            }));
        } catch {
            this.allBookings = [];
        }
        await Promise.all([
            matchController.loadSubmitted(playerID),
            ratingController.loadRated(playerID)
        ]);
        this.renderBookings(this.allBookings);
    },

    filterBookings(filter) {
        ['all', 'upcoming', 'past'].forEach(f => {
            const tab = document.getElementById(`tab-${f}`);
            tab.className = f === filter
                ? 'px-4 py-1.5 rounded-full text-sm font-medium bg-indigo-600 text-white transition-all'
                : 'px-4 py-1.5 rounded-full text-sm font-medium bg-slate-700 text-slate-400 hover:bg-slate-600 transition-all';
        });
        const today = localDateStr();
        let list = this.allBookings;
        if (filter === 'upcoming') list = list.filter(b => b.date >= today && b.status !== 'cancelled');
        if (filter === 'past')     list = list.filter(b => b.date < today || b.status === 'cancelled');
        this.renderBookings(list);
    },

    renderBookings(bookings) {
        const container = document.getElementById('bookingsContainer');
        if (!bookings || !bookings.length) {
            container.innerHTML = `
            <div class="text-center py-14 text-slate-500">
                <p class="text-5xl mb-3">🏟️</p>
                <p class="font-medium text-slate-400">No bookings yet</p>
                <p class="text-sm mt-1">Search for a court above and book your first slot.</p>
            </div>`;
            return;
        }
        const icons  = { tennis: '🎾', basketball: '🏀', futsal: '🥅', cricket: '🏏', football: '⚽', badminton: '🏸', squash: '🎯', volleyball: '🏐' };
        const styles = {
            confirmed: { bg: 'bg-teal-500/20',   text: 'text-teal-400',   dot: '●', label: 'Confirmed' },
            completed: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', dot: '✓', label: 'Completed' },
            cancelled: { bg: 'bg-red-500/20',    text: 'text-red-400',    dot: '✕', label: 'Cancelled'  },
            pending:   { bg: 'bg-amber-500/20',  text: 'text-amber-400',  dot: '◌', label: 'Pending'    }
        };
        const today  = localDateStr();
        const now    = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const sorted = [...bookings].sort((a, b) => new Date(b.date) - new Date(a.date));
        container.innerHTML = sorted.map(b => {
            const icon       = icons[(b.courtType || '').toLowerCase()] || '🏟️';
            const style      = styles[b.status] || styles.pending;
            const courtLabel = b.courtName || b.courtID;
            const dateStr    = new Date(b.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            const isFuture   = b.date >= today;
            const isPending  = b.status === 'pending'   && isFuture;
            const canCancel  = (b.status === 'confirmed' || b.status === 'pending') && isFuture;

            let slotEnded = b.date < today;
            if (!slotEnded && b.date === today) {
                try {
                    const [h, m] = b.timeSlot.split('-')[1].trim().split(':').map(Number);
                    slotEnded = nowMin > h * 60 + m;
                } catch { /* ignore */ }
            }
            const canSubmitResult = (b.status === 'confirmed' || b.status === 'completed')
                && slotEnded
                && !matchController.submittedBookingIDs.has(b.bookingID);
            const canRate = (b.status === 'confirmed' || b.status === 'completed')
                && slotEnded
                && !ratingController.ratedBookingIDs.has(b.bookingID);

            return `
            <div class="bg-slate-900/60 border ${isPending ? 'border-amber-500/40' : 'border-slate-700'} hover:border-slate-600 rounded-xl p-4 flex items-center justify-between transition-all gap-4">
                <div class="flex items-center gap-4 min-w-0">
                    <div class="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">${icon}</div>
                    <div class="min-w-0">
                        <p class="font-semibold text-white truncate">${courtLabel}</p>
                        <p class="text-xs text-slate-500 mb-0.5">${b.courtType || ''}</p>
                        <p class="text-sm text-slate-400">📅 ${dateStr} &nbsp;·&nbsp; ⏰ ${b.timeSlot}</p>
                        ${isPending ? `<p class="text-xs text-amber-400 mt-0.5">⚠ Payment incomplete — tap to complete</p>` : ''}
                    </div>
                </div>
                <div class="text-right flex-shrink-0 space-y-2">
                    <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}">${style.dot} ${style.label}</span>
                    <p class="text-white font-bold">PKR ${(b.totalCost || 0).toLocaleString()}</p>
                    ${isPending       ? `<button onclick="dashboardController.resumeBooking('${b.bookingID}')" class="w-full px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/30 transition-all">Complete Payment →</button>` : ''}
                    ${canCancel       ? `<button onclick="dashboardController.cancelBooking('${b.bookingID}')" class="w-full px-3 py-1 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-all">Cancel Booking</button>` : ''}
                    ${canSubmitResult ? `<button onclick="matchController.openModal('${b.bookingID}')" class="w-full px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-300 border border-indigo-500/30 transition-all">📊 Submit Result</button>` : ''}
                    ${canRate         ? `<button onclick="ratingController.openModal('${b.bookingID}')" class="w-full px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/25 transition-all">⭐ Rate Facility</button>` : ''}
                </div>
            </div>`;
        }).join('');
    },

    resumeBooking(bookingID) {
        const b = this.allBookings.find(x => x.bookingID === bookingID);
        if (!b) return;
        const params = new URLSearchParams({
            bookingID: b.bookingID,
            court:     b.courtName  || b.courtID,
            time:      b.timeSlot,
            price:     b.totalCost  || 0,
            isPeak:    b.peakHour   ? 1 : 0,
            date:      b.date       || ''
        });
        window.location.href = `checkout.html?${params.toString()}`;
    },

    _cancelTargetID: null,

    cancelBooking(bookingID) {
        const b = this.allBookings.find(x => x.bookingID === bookingID);
        if (!b) return;
        this._cancelTargetID = bookingID;

        const dateStr = new Date(b.date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric'
        });
        const detailsEl = document.getElementById('cancelModalDetails');
        if (detailsEl) {
            detailsEl.innerHTML = `
                <span class="font-semibold text-white">${b.courtName || b.courtID}</span><br>
                <span>${dateStr}</span> &nbsp;·&nbsp; <span>${b.timeSlot}</span><br>
                <span class="text-teal-400 font-medium">PKR ${(b.totalCost || 0).toLocaleString()}</span>`;
        }

        const modal = document.getElementById('cancelModal');
        if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
    },

    closeCancelModal() {
        const modal = document.getElementById('cancelModal');
        if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
        this._cancelTargetID = null;
        const btn = document.getElementById('confirmCancelBtn');
        if (btn) { btn.textContent = 'Yes, Cancel It'; btn.disabled = false; }
    },

    async confirmCancel() {
        const bookingID = this._cancelTargetID;
        if (!bookingID) return;

        const btn = document.getElementById('confirmCancelBtn');
        btn.textContent = 'Cancelling...'; btn.disabled = true;

        try {
            const res = await fetch(`${BOOKING_API}/${bookingID}/cancel`, { method: 'PUT' });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Could not cancel booking. Please try again.');
            }
        } catch (e) {
            if (!(e instanceof TypeError)) {
                btn.textContent = 'Yes, Cancel It'; btn.disabled = false;
                this._showToast(e.message, 'error');
                return;
            }
        }

        this.allBookings = this.allBookings.map(b =>
            b.bookingID === bookingID ? { ...b, status: 'cancelled' } : b
        );
        this.closeCancelModal();
        this.renderBookings(this.allBookings);
        this._showToast('Booking cancelled successfully.');
    },

    _showToast(msg, type = 'success') {
        const existing = document.getElementById('pfx-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'pfx-toast';
        const colour = type === 'error'
            ? 'bg-red-900/90 border-red-500/50 text-red-200'
            : 'bg-slate-800 border-slate-600 text-white';
        toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] ${colour} border text-sm px-5 py-3 rounded-xl shadow-2xl transition-opacity duration-300`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; }, 2500);
        setTimeout(() => toast.remove(), 2900);
    },

    openDeleteModal()  { document.getElementById('deleteModal').classList.remove('hidden'); },
    closeDeleteModal() { document.getElementById('deleteModal').classList.add('hidden'); },

    async confirmDelete() {
        const email = localStorage.getItem('playerEmail');
        if (!email) return;
        this.closeDeleteModal();
        try {
            const res = await fetch(`${AUTH_API}/request-deletion?playerEmail=${encodeURIComponent(email)}`, { method: 'POST' });
            if (!res.ok) throw new Error();
            document.getElementById('pendingDeletionOverlay').classList.remove('hidden');
        } catch (_) {
            showPopup('Failed to submit deletion request. Please try again.');
        }
    }
};

// ============================================================
// MATCH RESULT CONTROLLER  (dashboard.html)
// ============================================================
const matchController = {

    submittedBookingIDs: new Set(),
    _currentBookingID:   null,
    _selectedResult:     null,

    async loadSubmitted(playerID) {
        try {
            const res = await fetch(`${MATCH_API}/player/${encodeURIComponent(playerID)}`);
            if (!res.ok) return;
            const history = await res.json();
            this.submittedBookingIDs = new Set(history.map(m => m.bookingID));
        } catch { /* ignore */ }
    },

    openModal(bookingID) {
        const b = dashboardController.allBookings.find(x => x.bookingID === bookingID);
        if (!b) return;
        this._currentBookingID = bookingID;
        this._selectedResult   = null;

        document.getElementById('matchOpponent').value       = '';
        document.getElementById('matchPlayerScore').value    = '0';
        document.getElementById('matchOpponentScore').value  = '0';
        document.getElementById('matchResultError').classList.add('hidden');
        document.getElementById('submitMatchBtn').textContent = 'Submit Result';
        document.getElementById('submitMatchBtn').disabled    = false;

        ['WIN', 'DRAW', 'LOSS'].forEach(r =>
            document.getElementById(`resultBtn${r}`).className =
                'result-btn flex-1 py-2.5 rounded-lg text-sm font-semibold bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all border border-slate-600');

        const dateStr = new Date(b.date + 'T00:00:00').toLocaleDateString('en-US',
            { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        document.getElementById('matchModalBookingInfo').innerHTML =
            `<span class="font-medium text-white">${b.courtName || b.courtID}</span> &nbsp;·&nbsp; <span class="text-slate-400">${b.courtType || ''}</span><br>
             <span class="text-slate-400">📅 ${dateStr} &nbsp;·&nbsp; ⏰ ${b.timeSlot}</span>`;

        const modal = document.getElementById('matchResultModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    },

    closeModal() {
        const modal = document.getElementById('matchResultModal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        this._currentBookingID = null;
        this._selectedResult   = null;
    },

    selectResult(result) {
        this._selectedResult = result;
        const active = {
            WIN:  'result-btn flex-1 py-2.5 rounded-lg text-sm font-semibold bg-teal-600 text-white transition-all border border-teal-500',
            DRAW: 'result-btn flex-1 py-2.5 rounded-lg text-sm font-semibold bg-amber-600 text-white transition-all border border-amber-500',
            LOSS: 'result-btn flex-1 py-2.5 rounded-lg text-sm font-semibold bg-red-700 text-white transition-all border border-red-600'
        };
        const idle = 'result-btn flex-1 py-2.5 rounded-lg text-sm font-semibold bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all border border-slate-600';
        ['WIN', 'DRAW', 'LOSS'].forEach(r =>
            document.getElementById(`resultBtn${r}`).className = r === result ? active[r] : idle);
    },

    async submitResult() {
        if (!this._currentBookingID) return;
        if (!this._selectedResult) {
            this._showError('Please select a result — Win, Draw, or Loss.');
            return;
        }
        const opponentName  = document.getElementById('matchOpponent').value.trim();
        const playerScore   = parseInt(document.getElementById('matchPlayerScore').value)   || 0;
        const opponentScore = parseInt(document.getElementById('matchOpponentScore').value) || 0;
        if (!opponentName) {
            this._showError("Please enter your opponent's name.");
            return;
        }
        const btn = document.getElementById('submitMatchBtn');
        btn.textContent = 'Submitting…'; btn.disabled = true;
        try {
            const res = await fetch(`${MATCH_API}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingID:    this._currentBookingID,
                    playerID:     localStorage.getItem('playerID'),
                    opponentName,
                    playerScore,
                    opponentScore,
                    result:       this._selectedResult
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Failed to submit result');

            this.submittedBookingIDs.add(this._currentBookingID);
            this.closeModal();
            dashboardController.renderBookings(dashboardController.allBookings);
            dashboardController._showToast('Match result submitted! Points updated on leaderboard.');
            this.loadLeaderboard();
        } catch (e) {
            this._showError(e.message);
            btn.textContent = 'Submit Result'; btn.disabled = false;
        }
    },

    _showError(msg) {
        const el = document.getElementById('matchResultError');
        el.textContent = msg;
        el.classList.remove('hidden');
    },

    async loadLeaderboard() {
        const container = document.getElementById('leaderboardContainer');
        if (!container) return;
        try {
            const res = await fetch(`${MATCH_API}/leaderboard`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            if (!data.length) {
                container.innerHTML = `<p class="text-slate-500 text-sm text-center py-8">No ranked players yet — submit your first match result!</p>`;
                return;
            }
            const medals = ['🥇', '🥈', '🥉'];
            container.innerHTML = data.slice(0, 10).map((p, i) => `
            <div class="flex items-center justify-between ${i === 0 ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-900/60 border border-slate-700'} rounded-xl px-4 py-3">
                <div class="flex items-center gap-3">
                    <span class="text-lg w-7 text-center">${medals[i] !== undefined ? medals[i] : `<span class="text-slate-400 text-sm font-bold">${i + 1}</span>`}</span>
                    <span class="font-medium text-white text-sm">${p.playerName}</span>
                </div>
                <span class="text-sm font-bold ${i === 0 ? 'text-amber-400' : 'text-indigo-400'}">${p.rankPoints} pts</span>
            </div>`).join('');
        } catch {
            container.innerHTML = `<p class="text-slate-500 text-sm text-center py-8">Could not load leaderboard.</p>`;
        }
    }
};

// ============================================================
// FACILITY RATING CONTROLLER  (dashboard.html)
// ============================================================
const ratingController = {

    ratedBookingIDs: new Set(),
    _currentBookingID: null,
    _selectedScore: 5,

    async loadRated(playerID) {
        try {
            const res = await fetch(`${RATING_API}/player/${encodeURIComponent(playerID)}`);
            if (!res.ok) return;
            const ratings = await res.json();
            this.ratedBookingIDs = new Set(ratings.map(r => r.bookingID));
        } catch { /* ignore */ }
    },

    openModal(bookingID) {
        const b = dashboardController.allBookings.find(x => x.bookingID === bookingID);
        if (!b) return;
        this._currentBookingID = bookingID;
        this._selectedScore = 5;

        // Reset form
        document.getElementById('ratingFeedback').value = '';
        document.getElementById('ratingError').classList.add('hidden');
        document.getElementById('submitRatingBtn').textContent = 'Submit Rating';
        document.getElementById('submitRatingBtn').disabled = false;

        // Update star display
        this.selectStar(5);

        // Show booking info
        const dateStr = new Date(b.date + 'T00:00:00').toLocaleDateString('en-US',
            { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        document.getElementById('ratingBookingInfo').innerHTML =
            `<span class="font-medium text-white">${b.courtName || b.courtID}</span> &nbsp;·&nbsp; <span class="text-slate-400">${b.courtType || ''}</span><br>
             <span class="text-slate-400">📅 ${dateStr} &nbsp;·&nbsp; ⏰ ${b.timeSlot}</span>`;

        const modal = document.getElementById('ratingModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeModal() {
        const modal = document.getElementById('ratingModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        this._currentBookingID = null;
    },

    selectStar(score) {
        this._selectedScore = score;
        const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
        document.getElementById('starLabel').textContent = labels[score] || '';

        // Update star display
        for (let i = 1; i <= 5; i++) {
            const star = document.getElementById(`star${i}`);
            if (star) {
                star.textContent = i <= score ? '★' : '☆';
                star.className = i <= score
                    ? 'text-3xl cursor-pointer text-amber-400 transition-all hover:scale-110'
                    : 'text-3xl cursor-pointer text-slate-600 hover:text-amber-300 transition-all hover:scale-110';
            }
        }
    },

    async submitRating() {
        if (!this._currentBookingID) return;

        const score = this._selectedScore;
        const feedback = document.getElementById('ratingFeedback').value.trim();

        if (score < 1 || score > 5) {
            this._showError('Please select a rating between 1 and 5 stars.');
            return;
        }

        const btn = document.getElementById('submitRatingBtn');
        btn.textContent = 'Submitting…';
        btn.disabled = true;

        try {
            const b = dashboardController.allBookings.find(x => x.bookingID === this._currentBookingID);
            if (!b) throw new Error('Booking not found');

            const res = await fetch(`${RATING_API}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingID: this._currentBookingID,
                    playerID: localStorage.getItem('playerID'),
                    courtID: b.courtID,
                    courtName: b.courtName || b.courtID,
                    sportType: b.courtType,
                    ratingScore: score,
                    feedbackText: feedback,
                    bookingDate: b.date
                })
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Failed to submit rating');

            this.ratedBookingIDs.add(this._currentBookingID);
            this.closeModal();
            dashboardController.renderBookings(dashboardController.allBookings);
            dashboardController._showToast('Rating submitted! Thank you for your feedback.');
        } catch (e) {
            this._showError(e.message);
            btn.textContent = 'Submit Rating';
            btn.disabled = false;
        }
    },

    _showError(msg) {
        const el = document.getElementById('ratingError');
        if (el) {
            el.textContent = msg;
            el.classList.remove('hidden');
        }
    }
};

// Dashboard init
if (document.getElementById('bookingsContainer')) {
    dashboardController.loadMyBookings();
}
if (document.getElementById('searchDate')) {
    document.getElementById('searchDate').min = localDateStr();
}
if (document.getElementById('welcomeMsg')) {
    const name   = localStorage.getItem('playerName') || 'Player';
    const avatar = document.getElementById('welcomeAvatar');
    document.getElementById('welcomeMsg').textContent = `Welcome, ${name}`;
    if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
}

// ============================================================
// FACILITY MANAGER CONTROLLER  (facility-manager.html)
// ============================================================
const facilityController = {

    allCourts: [],
    editingId: null,

    _defaultCourts: [
        { courtID: 'CRT-001', name: 'Main Tennis Court',      sportType: 'TENNIS',     hourlyRate: 500, capacity: 4,  openTime: '08:00', closeTime: '22:00', slotDurationMinutes: 60, status: 'AVAILABLE',   description: 'Professional hard court with floodlights' },
        { courtID: 'CRT-002', name: 'Indoor Basketball Arena', sportType: 'BASKETBALL', hourlyRate: 800, capacity: 10, openTime: '09:00', closeTime: '21:00', slotDurationMinutes: 60, status: 'AVAILABLE',   description: 'Full-size maple hardwood floor' },
        { courtID: 'CRT-003', name: 'Futsal Ground A',         sportType: 'FUTSAL',     hourlyRate: 700, capacity: 12, openTime: '10:00', closeTime: '23:00', slotDurationMinutes: 60, status: 'MAINTENANCE', description: 'Premium astroturf surface' },
        { courtID: 'CRT-004', name: 'Cricket Net Zone',        sportType: 'CRICKET',    hourlyRate: 400, capacity: 6,  openTime: '07:00', closeTime: '19:00', slotDurationMinutes: 60, status: 'AVAILABLE',   description: 'Two nets with bowling machines' },
        { courtID: 'CRT-005', name: 'Badminton Hall 1',        sportType: 'BADMINTON',  hourlyRate: 300, capacity: 4,  openTime: '08:00', closeTime: '22:00', slotDurationMinutes: 60, status: 'CLOSED',      description: 'Air-conditioned indoor hall' }
    ],

    _getLocal()        { const d = localStorage.getItem('fm_courts'); return d ? JSON.parse(d) : JSON.parse(JSON.stringify(this._defaultCourts)); },
    _saveLocal(courts) { localStorage.setItem('fm_courts', JSON.stringify(courts)); },

    async loadCourts() {
        const grid = document.getElementById('courtsGrid');
        if (!grid) return;
        grid.innerHTML = `<p class="text-indigo-400 animate-pulse col-span-full text-sm">Loading courts...</p>`;
        try {
            const res = await fetch(COURT_API);
            if (!res.ok) throw new Error();
            this.allCourts = await res.json();
            this._saveLocal(this.allCourts);
        } catch {
            this.allCourts = this._getLocal();
        }
        this.updateStats();
        this.renderCourts(this.allCourts);
    },

    filterBySport(sport) {
        document.querySelectorAll('.sport-tab').forEach(btn => {
            btn.className = btn.dataset.sport === sport
                ? 'sport-tab px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-600 text-white transition-all'
                : 'sport-tab px-3 py-1.5 rounded-full text-sm font-medium bg-slate-700 text-slate-400 hover:bg-slate-600 transition-all';
        });
        const filtered = sport === 'ALL' ? this.allCourts : this.allCourts.filter(c => c.sportType === sport);
        this.renderCourts(filtered);
    },

    updateStats() {
        document.getElementById('stat-total').textContent  = this.allCourts.length;
        document.getElementById('stat-avail').textContent  = this.allCourts.filter(c => c.status === 'AVAILABLE').length;
        document.getElementById('stat-maint').textContent  = this.allCourts.filter(c => c.status === 'MAINTENANCE').length;
        document.getElementById('stat-closed').textContent = this.allCourts.filter(c => c.status === 'CLOSED').length;
    },

    renderCourts(courts) {
        const grid = document.getElementById('courtsGrid');
        if (!courts || !courts.length) {
            grid.innerHTML = `<div class="col-span-full text-center py-16 text-slate-500"><p class="text-5xl mb-3">🏟️</p><p class="font-medium">No courts found.</p><p class="text-sm mt-1">Add a court using the button above.</p></div>`;
            return;
        }
        const icons = { CRICKET: '🏏', FOOTBALL: '⚽', TENNIS: '🎾', BASKETBALL: '🏀', FUTSAL: '🥅', BADMINTON: '🏸', SQUASH: '🎯', VOLLEYBALL: '🏐' };
        const statusStyle = {
            AVAILABLE:   { badge: 'bg-teal-500/20 text-teal-400',   dot: '●', label: 'Available'   },
            MAINTENANCE: { badge: 'bg-amber-500/20 text-amber-400', dot: '⚙', label: 'Maintenance' },
            CLOSED:      { badge: 'bg-red-500/20 text-red-400',     dot: '✕', label: 'Closed'      }
        };
        grid.innerHTML = courts.map(c => {
            const icon = icons[c.sportType] || '🏟️';
            const s    = statusStyle[c.status] || statusStyle.AVAILABLE;
            const safe = c.name.replace(/'/g, "\\'");
            return `
            <div class="bg-slate-800/50 backdrop-blur-xl border border-slate-700 hover:border-slate-500 rounded-2xl p-5 flex flex-col transition-all">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex items-center gap-2">
                        <span class="text-2xl">${icon}</span>
                        <span class="text-xs font-bold uppercase tracking-wider text-indigo-400">${c.sportType}</span>
                    </div>
                    <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${s.badge}">${s.dot} ${s.label}</span>
                </div>
                <h3 class="font-bold text-white text-lg mb-3">${c.name}</h3>
                <div class="space-y-1.5 mb-3 flex-1">
                    ${c.openTime && c.closeTime ? `<p class="text-sm text-slate-400">⏰ ${c.openTime} – ${c.closeTime}</p>` : ''}
                    <p class="text-sm text-slate-400">⏱ ${c.slotDurationMinutes || 60} min per slot</p>
                    ${c.capacity ? `<p class="text-sm text-slate-400">👥 ${c.capacity} players max</p>` : ''}
                    <p class="text-sm text-teal-400 font-semibold">PKR ${c.hourlyRate.toLocaleString()} / hr</p>
                    ${c.peakStartTime ? `<p class="text-xs text-amber-400">⚡ Peak ${c.peakStartTime}–${c.peakEndTime} (×${c.peakMultiplier})</p>` : ''}
                </div>
                ${c.description ? `<p class="text-xs text-slate-500 italic mb-3 line-clamp-2">${c.description}</p>` : ''}
                <div class="flex gap-2 pt-3 border-t border-slate-700 mt-auto">
                    <button onclick="facilityController.viewSlots('${c.courtID}')"
                        class="flex-1 text-xs py-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-slate-300 transition-colors">⏱ Slots</button>
                    <button onclick="facilityController.openModal('${c.courtID}')"
                        class="flex-1 text-xs py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 transition-colors">✎ Edit</button>
                    <button onclick="facilityController.openMaintModal('${c.courtID}','${safe}')"
                        class="flex-1 text-xs py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 transition-colors">🔧 Maint</button>
                    <button onclick="facilityController.deleteCourt('${c.courtID}','${safe}')"
                        class="flex-1 text-xs py-1.5 rounded-lg bg-red-600/10 hover:bg-red-600/30 text-red-400 transition-colors">✕ Delete</button>
                </div>
            </div>`;
        }).join('');
    },

    openModal(courtId = null) {
        this.editingId = courtId;
        document.getElementById('courtForm').reset();
        document.getElementById('f-open').value         = '08:00';
        document.getElementById('f-close').value        = '22:00';
        document.getElementById('f-slot').value         = '60';
        document.getElementById('f-status').value       = 'AVAILABLE';
        document.getElementById('f-peak-start').value   = '';
        document.getElementById('f-peak-end').value     = '';
        document.getElementById('f-peak-mult').value    = '';
        document.getElementById('f-weekend-mult').value = '';

        if (courtId) {
            const c = this.allCourts.find(x => x.courtID === courtId);
            if (!c) return;
            document.getElementById('modalTitle').textContent  = 'Edit Court';
            document.getElementById('f-name').value           = c.name;
            document.getElementById('f-sport').value          = c.sportType;
            document.getElementById('f-rate').value           = c.hourlyRate;
            document.getElementById('f-capacity').value       = c.capacity || '';
            document.getElementById('f-open').value           = c.openTime  || '08:00';
            document.getElementById('f-close').value          = c.closeTime || '22:00';
            document.getElementById('f-slot').value           = c.slotDurationMinutes || 60;
            document.getElementById('f-status').value         = c.status   || 'AVAILABLE';
            document.getElementById('f-peak-start').value     = c.peakStartTime   || '';
            document.getElementById('f-peak-end').value       = c.peakEndTime     || '';
            document.getElementById('f-peak-mult').value      = c.peakMultiplier  > 1 ? c.peakMultiplier  : '';
            document.getElementById('f-weekend-mult').value   = c.weekendMultiplier > 1 ? c.weekendMultiplier : '';
            document.getElementById('f-desc').value           = c.description || '';
        } else {
            document.getElementById('modalTitle').textContent = 'Add New Court';
        }

        const modal = document.getElementById('courtModal');
        modal.classList.remove('hidden'); modal.classList.add('flex');
    },

    closeModal() {
        const modal = document.getElementById('courtModal');
        modal.classList.add('hidden'); modal.classList.remove('flex');
        this.editingId = null;
    },

    async saveCourt(event) {
        event.preventDefault();
        const btn = document.getElementById('modalSaveBtn');
        btn.textContent = 'Saving...'; btn.disabled = true;

        const data = {
            name:                document.getElementById('f-name').value.trim(),
            sportType:           document.getElementById('f-sport').value,
            hourlyRate:          parseFloat(document.getElementById('f-rate').value),
            capacity:            parseInt(document.getElementById('f-capacity').value) || 0,
            openTime:            document.getElementById('f-open').value,
            closeTime:           document.getElementById('f-close').value,
            slotDurationMinutes: parseInt(document.getElementById('f-slot').value),
            status:              document.getElementById('f-status').value,
            peakStartTime:       document.getElementById('f-peak-start').value || null,
            peakEndTime:         document.getElementById('f-peak-end').value   || null,
            peakMultiplier:      parseFloat(document.getElementById('f-peak-mult').value)    || 1.0,
            weekendMultiplier:   parseFloat(document.getElementById('f-weekend-mult').value) || 1.0,
            description:         document.getElementById('f-desc').value.trim(),
            managerId:           localStorage.getItem('playerID') || null
        };

        try {
            const url    = this.editingId ? `${COURT_API}/${this.editingId}` : COURT_API;
            const method = this.editingId ? 'PUT' : 'POST';
            const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (!res.ok) throw new Error();
            this.allCourts = await fetch(COURT_API).then(r => r.json());
            this._saveLocal(this.allCourts);
        } catch {
            if (this.editingId) {
                const idx = this.allCourts.findIndex(c => c.courtID === this.editingId);
                if (idx !== -1) this.allCourts[idx] = { ...this.allCourts[idx], ...data };
            } else {
                this.allCourts.push({ ...data, courtID: 'CRT-' + Date.now() });
            }
            this._saveLocal(this.allCourts);
        }

        btn.textContent = 'Save Court'; btn.disabled = false;
        this.closeModal();
        this.updateStats();
        this.renderCourts(this.allCourts);
    },

    deleteCourt(courtId, courtName) {
        showConfirm(`Delete "<strong>${courtName}</strong>"? This cannot be undone.`, async () => {
            try {
                const res = await fetch(`${COURT_API}/${courtId}`, { method: 'DELETE' });
                if (!res.ok) throw new Error();
            } catch {
                /* offline — remove from local state */
            }
            this.allCourts = this.allCourts.filter(c => c.courtID !== courtId);
            this._saveLocal(this.allCourts);
            this.updateStats();
            this.renderCourts(this.allCourts);
        });
    },

    viewSlots(courtId) {
        const c = this.allCourts.find(x => x.courtID === courtId);
        if (!c) return;
        document.getElementById('slotsModalTitle').textContent = c.name;
        document.getElementById('slotsModalMeta').textContent  = `${c.openTime} – ${c.closeTime}  •  ${c.slotDurationMinutes || 60} min slots`;

        const slots = this._generateSlots(c);
        const grid  = document.getElementById('slotsGrid');
        grid.innerHTML = slots.length
            ? slots.map(s => `
                <div class="bg-slate-900/80 border border-slate-700 rounded-lg p-2 text-center">
                    <p class="text-sm font-semibold text-white">${s.start}</p>
                    <p class="text-xs text-slate-500">→ ${s.end}</p>
                </div>`).join('')
            : `<p class="col-span-3 text-slate-400 text-sm">Set open/close times to generate slots.</p>`;

        const modal = document.getElementById('slotsModal');
        modal.classList.remove('hidden'); modal.classList.add('flex');
    },

    closeSlotsModal() {
        const modal = document.getElementById('slotsModal');
        modal.classList.add('hidden'); modal.classList.remove('flex');
    },

    _generateSlots(court) {
        if (!court.openTime || !court.closeTime) return [];
        const [oh, om] = court.openTime.split(':').map(Number);
        const [ch, cm] = court.closeTime.split(':').map(Number);
        const open  = oh * 60 + om;
        let   close = ch * 60 + cm;
        if (close <= open) close += 24 * 60; // handle past-midnight close times
        const dur   = court.slotDurationMinutes || 60;
        const slots = [];
        for (let t = open; t + dur <= close; t += dur) {
            const pad = n => String(Math.floor(n)).padStart(2, '0');
            const tMod = t % 1440;
            const eMod = (t + dur) % 1440;
            slots.push({
                start: `${pad(tMod / 60)}:${pad(tMod % 60)}`,
                end:   `${pad(eMod / 60)}:${pad(eMod % 60)}`
            });
        }
        return slots;
    },

    openMaintModal(courtID, courtName, existingFrom = '', existingTo = '') {
        document.getElementById('maintCourtID').value   = courtID;
        document.getElementById('maintCourtName').textContent = courtName;
        document.getElementById('maintFrom').value = existingFrom;
        document.getElementById('maintTo').value   = existingTo;
        document.getElementById('maintMsg').textContent = '';
        const m = document.getElementById('maintModal');
        m.classList.remove('hidden');
        m.classList.add('flex');
    },

    closeMaintModal() {
        const m = document.getElementById('maintModal');
        m.classList.add('hidden');
        m.classList.remove('flex');
    },

    async submitMaintenance(event) {
        event.preventDefault();
        const courtID = document.getElementById('maintCourtID').value;
        const from    = document.getElementById('maintFrom').value;
        const to      = document.getElementById('maintTo').value;
        const msg     = document.getElementById('maintMsg');
        if (!from) { msg.textContent = 'Start date/time is required.'; msg.className = 'text-sm text-red-400 mt-2'; return; }
        try {
            const res = await fetch(`${API_BASE}/api/manager/courts/${encodeURIComponent(courtID)}/schedule-maintenance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maintenanceFrom: from, maintenanceTo: to || null })
            });
            const data = await res.json();
            if (!res.ok) { msg.textContent = data.error || 'Failed to schedule.'; msg.className = 'text-sm text-red-400 mt-2'; return; }
            msg.textContent = 'Maintenance scheduled successfully.';
            msg.className = 'text-sm text-teal-400 mt-2';
            setTimeout(() => this.closeMaintModal(), 1500);
            this.loadCourts();
            loadScheduledMaintenances();
        } catch (e) {
            msg.textContent = 'Network error. Try again.';
            msg.className = 'text-sm text-red-400 mt-2';
        }
    }
};

// Facility manager init
if (document.getElementById('courtsGrid')) {
    facilityController.loadCourts();
}
if (document.getElementById('managerWelcome')) {
    const name   = localStorage.getItem('playerName') || 'Manager';
    const avatar = document.getElementById('managerAvatar');
    document.getElementById('managerWelcome').textContent = `Welcome, ${name}`;
    if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
}

// Manager booking tables
async function loadManagerBookings() {
    const managerID = localStorage.getItem('playerID');
    if (!managerID || !document.getElementById('upcomingBookingsBody')) return;

    const fmtStatus = s => s === 'CONFIRMED'
        ? '<span class="px-2 py-0.5 rounded-full text-xs bg-teal-500/20 text-teal-400">Paid</span>'
        : '<span class="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400">Unpaid</span>';

    try {
        const [upRes, compRes] = await Promise.all([
            fetch(`${API_BASE}/api/manager/bookings/upcoming?managerID=${encodeURIComponent(managerID)}`),
            fetch(`${API_BASE}/api/manager/bookings/completed?managerID=${encodeURIComponent(managerID)}`)
        ]);
        const upcoming  = await upRes.json();
        const completed = await compRes.json();

        const upBody = document.getElementById('upcomingBookingsBody');
        upBody.innerHTML = upcoming.length ? upcoming.map(b => `
            <tr class="border-t border-slate-700/50 hover:bg-slate-700/20">
                <td class="px-4 py-3 text-sm text-slate-300">${b.courtName}</td>
                <td class="px-4 py-3 text-sm text-slate-300">${b.playerName}</td>
                <td class="px-4 py-3 text-sm text-slate-400">${b.playerEmail}</td>
                <td class="px-4 py-3 text-sm text-slate-300">${b.bookingDate}</td>
                <td class="px-4 py-3 text-sm text-slate-300">${b.timeSlot}</td>
                <td class="px-4 py-3 text-sm text-teal-400 font-semibold">PKR ${b.totalCost.toLocaleString()}</td>
                <td class="px-4 py-3">${fmtStatus(b.status)}</td>
            </tr>`).join('')
            : '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-500 text-sm">No upcoming bookings</td></tr>';

        const compBody = document.getElementById('pastBookingsBody');
        compBody.innerHTML = completed.length ? completed.map(b => `
            <tr class="border-t border-slate-700/50 hover:bg-slate-700/20">
                <td class="px-4 py-3 text-sm text-slate-300">${b.courtName}</td>
                <td class="px-4 py-3 text-sm text-slate-300">${b.playerName}</td>
                <td class="px-4 py-3 text-sm text-slate-400">${b.playerEmail}</td>
                <td class="px-4 py-3 text-sm text-slate-300">${b.bookingDate}</td>
                <td class="px-4 py-3 text-sm text-slate-300">${b.timeSlot}</td>
                <td class="px-4 py-3 text-sm text-teal-400 font-semibold">PKR ${b.totalCost.toLocaleString()}</td>
            </tr>`).join('')
            : '<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500 text-sm">No completed bookings</td></tr>';
    } catch (_) {}
}

if (document.getElementById('upcomingBookingsBody')) {
    loadManagerBookings();
}

// Scheduled maintenances table
async function loadScheduledMaintenances() {
    const managerID = localStorage.getItem('playerID');
    const tbody = document.getElementById('scheduledMaintenancesBody');
    if (!managerID || !tbody) return;

    const fmtDt = iso => {
        if (!iso) return '<span class="text-slate-500">No end time</span>';
        const d = new Date(iso);
        return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
            + ' ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
    };

    try {
        const res  = await fetch(`${API_BASE}/api/manager/courts/maintenances?managerID=${encodeURIComponent(managerID)}`);
        const rows = await res.json();

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500 text-sm">No maintenances scheduled</td></tr>';
            return;
        }

        tbody.innerHTML = rows.map(m => {
            const statusBadge = m.status === 'MAINTENANCE'
                ? '<span class="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400">⚙ Active</span>'
                : '<span class="px-2 py-0.5 rounded-full text-xs bg-slate-600/40 text-slate-400">Scheduled</span>';
            const safeFrom = m.maintenanceFrom ? m.maintenanceFrom.substring(0, 16) : '';
            const safeTo   = m.maintenanceTo   ? m.maintenanceTo.substring(0, 16)   : '';
            const safeName = m.courtName.replace(/'/g, "\\'");
            return `
            <tr class="border-t border-slate-700/50 hover:bg-slate-700/20">
                <td class="px-4 py-3 text-sm text-slate-300">${m.courtName}</td>
                <td class="px-4 py-3 text-sm text-slate-400">${m.sportType}</td>
                <td class="px-4 py-3">${statusBadge}</td>
                <td class="px-4 py-3 text-sm text-slate-300">${fmtDt(m.maintenanceFrom)}</td>
                <td class="px-4 py-3 text-sm text-slate-300">${fmtDt(m.maintenanceTo)}</td>
                <td class="px-4 py-3">
                    <div class="flex gap-2">
                        <button onclick="facilityController.openMaintModal('${m.courtID}','${safeName}','${safeFrom}','${safeTo}')"
                            class="text-xs px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 transition-colors">Edit</button>
                        <button onclick="cancelMaintenance('${m.courtID}')"
                            class="text-xs px-3 py-1.5 rounded-lg bg-red-600/10 hover:bg-red-600/30 text-red-400 transition-colors">Cancel</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    } catch (_) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500 text-sm">Failed to load</td></tr>';
    }
}

function cancelMaintenance(courtID) {
    showConfirm(
        'Cancel this scheduled maintenance? The court will revert to Available if it was currently auto-switched to Maintenance.',
        async () => {
            try {
                const res = await fetch(`${API_BASE}/api/manager/courts/${encodeURIComponent(courtID)}/schedule-maintenance`, {
                    method: 'DELETE'
                });
                if (res.ok) {
                    loadScheduledMaintenances();
                    facilityController.loadCourts();
                }
            } catch (_) {}
        },
        'Cancel Maintenance',
        'bg-amber-600 hover:bg-amber-500'
    );
}

if (document.getElementById('scheduledMaintenancesBody')) {
    loadScheduledMaintenances();
}

// ============================================================
// NOTIFICATION CONTROLLER  (all dashboards)
// ============================================================
const notificationController = {

    _pollTimer: null,

    _getEffectiveUserId() {
        const role = localStorage.getItem('userRole');
        if (role === 'admin') return 'ADMIN';
        return localStorage.getItem('playerID') || '';
    },

    // n.read is reliable after @JsonProperty("read") on backend,
    // but also handle n.isRead as fallback for safety
    _isRead(n) {
        return n.read === true || n.isRead === true;
    },

    init() {
        const userId = this._getEffectiveUserId();
        if (!userId) return;

        // Portal: move dropdown to <body> so it escapes the nav's backdrop-filter
        // stacking context entirely — this is the only reliable cross-browser fix
        const dd = document.getElementById('notifDropdown');
        if (dd && dd.parentElement !== document.body) {
            document.body.appendChild(dd);
        }

        this.load();
        this._pollTimer = setInterval(() => this.load(), 10000);

        document.addEventListener('click', e => {
            const bell = document.getElementById('notifBell');
            const drop = document.getElementById('notifDropdown');
            if (!drop || !bell) return;
            if (!drop.contains(e.target) && !bell.contains(e.target)) {
                drop.classList.add('hidden');
            }
        });
    },

    async load() {
        const userId = this._getEffectiveUserId();
        if (!userId) return;
        try {
            const res = await fetch(`${NOTIF_API}?userId=${encodeURIComponent(userId)}`);
            if (!res.ok) return;
            const notifications = await res.json();
            this._render(notifications);
        } catch (_) {}
    },

    _render(notifications) {
        const badge = document.getElementById('notifBadge');
        const list  = document.getElementById('notifList');
        if (!badge || !list) return;

        const unreadCount = notifications.filter(n => !this._isRead(n)).length;
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        if (!notifications.length) {
            list.innerHTML = `<p class="text-center py-10 text-sm" style="color:#64748b;">No notifications yet</p>`;
            return;
        }

        list.innerHTML = notifications.slice(0, 30).map(n => {
            const read      = this._isRead(n);
            const icon      = this._icon(n.type);
            const timeAgo   = this._timeAgo(n.createdAt);
            const unreadCls = !read ? 'border-l-[3px] border-indigo-500' : '';
            const bg        = !read ? 'background:rgba(99,102,241,0.12)' : '';
            return `
            <div data-nid="${n.notificationID}" class="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${unreadCls}"
                 style="border-bottom:1px solid rgba(51,65,85,0.5);${bg}"
                 onmouseover="this.style.background='rgba(51,65,85,0.5)'"
                 onmouseout="this.style.background='${!read ? 'rgba(99,102,241,0.12)' : ''}'"
                 onclick="notificationController.markRead('${n.notificationID}', this)">
                <span style="font-size:1.2rem;margin-top:2px;flex-shrink:0">${icon}</span>
                <div style="flex:1;min-width:0">
                    <p style="font-size:0.82rem;font-weight:600;color:${read ? '#94a3b8' : '#f1f5f9'};margin:0 0 2px">${n.title}</p>
                    <p style="font-size:0.75rem;color:#94a3b8;line-height:1.45;margin:0 0 4px">${n.message}</p>
                    <p style="font-size:0.7rem;color:#475569;margin:0">${timeAgo}</p>
                </div>
                <button onclick="event.stopPropagation();notificationController.dismiss('${n.notificationID}',this.closest('[data-nid]'))"
                        title="Dismiss"
                        style="flex-shrink:0;width:18px;height:18px;border-radius:50%;border:none;cursor:pointer;background:rgba(71,85,105,0.5);color:#94a3b8;font-size:0.75rem;line-height:1;display:flex;align-items:center;justify-content:center;margin-top:2px;transition:background 0.15s"
                        onmouseover="this.style.background='rgba(239,68,68,0.4)';this.style.color='#f87171'"
                        onmouseout="this.style.background='rgba(71,85,105,0.5)';this.style.color='#94a3b8'">×</button>
                ${!read ? '<div style="width:8px;height:8px;border-radius:50%;background:#818cf8;margin-top:6px;flex-shrink:0"></div>' : ''}
            </div>`;
        }).join('');
    },

    _icon(type) {
        const map = {
            PROFILE_VERIFIED:     '✅',
            PROFILE_REJECTED:     '❌',
            BOOKING_CONFIRMED:    '📅',
            BOOKING_CANCELLED:    '🚫',
            BOOKING_EXPIRED:      '⏰',
            SLOT_STARTING:        '🏃',
            BOOKING_MADE:         '🎯',
            VERIFICATION_REQUEST: '📋',
            DELETION_REQUEST:     '🗑️',
            DELETION_CANCELLED:   '♻️',
            NEW_REGISTRATION:     '👤',
            PAYMENT_CONFIRMED:    '💳',
            LOW_RATING:           '⭐',
        };
        return map[type] || '🔔';
    },

    _timeAgo(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const diff = Date.now() - date.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1)   return 'Just now';
        if (mins < 60)  return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24)   return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    },

    toggleDropdown() {
        const dd   = document.getElementById('notifDropdown');
        const bell = document.getElementById('notifBell');
        if (!dd || !bell) return;

        const isOpening = dd.classList.contains('hidden');

        if (isOpening) {
            // Compute position from bell's viewport rect so the dropdown
            // renders below the bell regardless of scroll or nav position
            const rect = bell.getBoundingClientRect();
            dd.style.top   = (rect.bottom + 6) + 'px';
            dd.style.right = (window.innerWidth - rect.right) + 'px';
            dd.style.left  = 'auto';
            dd.classList.remove('hidden');
            this.load().then(() => this._markAllReadSilent());
        } else {
            dd.classList.add('hidden');
        }
    },

    async _markAllReadSilent() {
        const userId = this._getEffectiveUserId();
        if (!userId) return;
        try {
            await fetch(`${NOTIF_API}/read-all?userId=${encodeURIComponent(userId)}`, { method: 'PUT' });
        } catch (_) {}
        // Reload to reflect read state & hide badge
        await this.load();
    },

    async markRead(id, el) {
        try {
            await fetch(`${NOTIF_API}/${id}/read`, { method: 'PUT' });
        } catch (_) {}
        // Visually mark item as read immediately
        if (el) {
            el.classList.remove('border-l-[3px]', 'border-indigo-500');
            el.style.background = '';
            el.onmouseout = () => { el.style.background = ''; };
            const dot = el.querySelector('[style*="border-radius:50%"]');
            if (dot) dot.remove();
            const title = el.querySelector('p[style*="color:#f1f5f9"]');
            if (title) title.style.color = '#94a3b8';
        }
        // Reload to update bell badge count
        await this.load();
    },

    async markAllRead() {
        await this._markAllReadSilent();
    },

    async dismiss(id, el) {
        if (el) el.remove();
        try {
            await fetch(`${NOTIF_API}/${id}`, { method: 'DELETE' });
        } catch (_) {}
        await this.load();
    },

    async clearAll() {
        const userId = this._getEffectiveUserId();
        if (!userId) return;
        showConfirm(
            'Clear all notifications? This cannot be undone.',
            async () => {
                try {
                    await fetch(`${NOTIF_API}/all?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
                } catch (_) {}
                await this.load();
            },
            'Clear All',
            'bg-red-600 hover:bg-red-500'
        );
    }
};

// Init notifications on every protected page
if (document.getElementById('notifBell')) {
    notificationController.init();
}
