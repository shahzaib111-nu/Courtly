const DOCS_API = `${API_BASE}/api/docs`;

        const verificationController = {
            selectedFile: null,

            handleFileSelect(input) {
                const file = input.files[0];
                const errorEl = document.getElementById('fileError');
                const previewEl = document.getElementById('filePreview');
                const dropText = document.getElementById('dropText');

                errorEl.classList.add('hidden');

                if (!file) return;

                const ext = file.name.split('.').pop().toLowerCase();
                if (!['jpg', 'jpeg', 'png', 'pdf'].includes(ext)) {
                    errorEl.textContent = 'Invalid file type. Please upload JPG, PNG, or PDF.';
                    errorEl.classList.remove('hidden');
                    this.selectedFile = null;
                    return;
                }

                if (file.size > 5 * 1024 * 1024) {
                    errorEl.textContent = 'File too large. Maximum size is 5MB.';
                    errorEl.classList.remove('hidden');
                    this.selectedFile = null;
                    return;
                }

                this.selectedFile = file;
                document.getElementById('fileName').textContent = file.name;
                document.getElementById('fileSize').textContent = (file.size / 1024).toFixed(1) + ' KB';
                previewEl.classList.remove('hidden');
                dropText.classList.add('hidden');
            },

            async submit(event) {
                event.preventDefault();

                const email = document.getElementById('playerEmail').value.trim();
                const docType = document.getElementById('docType').value;
                const btn = document.getElementById('submitBtn');

                if (!this.selectedFile) {
                    document.getElementById('fileError').textContent = 'Please select a file before submitting.';
                    document.getElementById('fileError').classList.remove('hidden');
                    return;
                }

                btn.textContent = 'Uploading…';
                btn.disabled = true;

                const formData = new FormData();
                formData.append('file', this.selectedFile);
                formData.append('docType', docType);
                formData.append('playerEmail', email);

                try {
                    const response = await fetch(`${DOCS_API}/upload`, {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        const msg = await response.text();
                        throw new Error(msg);
                    }

                    localStorage.setItem('playerEmail', email);
                    document.getElementById('verificationForm').classList.add('hidden');
                    document.getElementById('successState').classList.remove('hidden');

                } catch (err) {
                    const errEl = document.getElementById('fileError');
                    errEl.textContent = 'Upload failed: ' + err.message;
                    errEl.classList.remove('hidden');
                    btn.textContent = 'Submit for Verification';
                    btn.disabled = false;
                }
            },

            async loadStatus() {
                const email = new URLSearchParams(window.location.search).get('email')
                    || localStorage.getItem('playerEmail');
                if (!email) return;

                document.getElementById('playerEmail').value = email;

                try {
                    const res = await fetch(`${DOCS_API}/status?playerEmail=${encodeURIComponent(email)}`);
                    const docs = await res.json();
                    if (!docs.length) return;

                    const latest = docs[docs.length - 1];
                    const banner = document.getElementById('statusBanner');
                    banner.classList.remove('hidden');

                    const statusStyles = {
                        PENDING: 'bg-yellow-900/40 border-yellow-700 text-yellow-300',
                        APPROVED: 'bg-emerald-900/40 border-emerald-700 text-emerald-300',
                        REJECTED: 'bg-red-900/40 border-red-700 text-red-300'
                    };
                    const statusIcons = { PENDING: '⏳', APPROVED: '✅', REJECTED: '❌' };

                    banner.className = `mb-6 p-4 rounded-xl border text-sm font-medium ${statusStyles[latest.status] || ''}`;
                    banner.textContent = `${statusIcons[latest.status] || ''} Your last submission status: ${latest.status}${latest.rejectionReason ? ' — Reason: ' + latest.rejectionReason : ''}`;
                } catch (_) {}
            }
        };

        verificationController.loadStatus();
