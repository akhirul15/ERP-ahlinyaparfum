// --- MODUL: HAK AKSES & LOGIN ---

const Auth = {
    backendUrl: "http://localhost:3000/api",
    currentUser: null,


    init() {
        // Cek apakah ada sesi login tersimpan di browser
        const savedSession = localStorage.getItem('ahlinya_session');
        if (savedSession) {
            this.currentUser = JSON.parse(savedSession);
            this.hideLoginModal();
            this.updateUI();
        } else {
            this.showLoginModal();
        }
        this.attachEvents();
    },

    attachEvents() {
        const btnLogin = document.getElementById('btnLogin');
        const inputPin = document.getElementById('loginPin');
        const btnLogout = document.getElementById('btnLogout'); // Tambahan baru

        if (btnLogin) {
            btnLogin.onclick = () => this.processLogin();
        }

        // Memungkinkan login dengan menekan tombol Enter di kolom PIN
        if (inputPin) {
            inputPin.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.processLogin();
                }
            };
        }

        // Event untuk tombol Logout
        if (btnLogout) {
            btnLogout.onclick = () => this.logout();
        }
    },

    async processLogin() {
        const username = document.getElementById('loginUsername').value.trim().toLowerCase();
        const pin = document.getElementById('loginPin').value.trim();

        if (!username || !pin) {
            this.showToast('Harap isi username dan PIN');
            return;
        }

        try {
            const response = await fetch(`${this.backendUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password: pin })
            });

            const data = await response.json();

            if (response.ok) {
                this.currentUser = {
                    id: data.user.id,
                    username: data.user.username,
                    role: data.user.role,
                    name: data.user.username,
                    branch_id: data.user.branch_id,
                    branch_name: data.user.branch_name,
                    token: data.token
                };

                localStorage.setItem('ahlinya_session', JSON.stringify(this.currentUser));

                this.hideLoginModal();
                this.updateUI();
                this.showToast(`Selamat datang, ${this.currentUser.name} (${this.currentUser.role})`);

                document.getElementById('loginUsername').value = '';
                document.getElementById('loginPin').value = '';
            } else {
                this.showToast(data.error || 'Username atau PIN salah!');
            }
        } catch (error) {
            console.error("Login Error:", error);
            this.showToast('Terjadi kesalahan koneksi server');
        }
    },


    logout() {
        this.currentUser = null;
        localStorage.removeItem('ahlinya_session');
        this.showLoginModal();
        this.showToast('Berhasil logout');
    },

    // FITUR PENTING: Mengecek apakah user saat ini punya hak akses tertentu
    // Contoh pemakaian: Auth.requireRole(['Superadmin'], () => { jalankanVoid() });
    requireRole(allowedRoles, callbackAction) {
        if (!this.currentUser) {
            this.showToast('Sesi habis, silakan login ulang.');
            this.logout();
            return;
        }

        if (allowedRoles.includes(this.currentUser.role)) {
            // Jika role sesuai, jalankan fungsinya
            callbackAction();
        } else {
            // Jika role tidak sesuai (misal Kasir mencoba masuk panel Superadmin)
            this.showToast(`Akses ditolak! Membutuhkan hak akses: ${allowedRoles.join(' / ')}`);
        }
    },

    // --- Bantuan Manipulasi UI DOM ---
    showLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) modal.classList.remove('hidden');
    },

    hideLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) modal.classList.add('hidden');
    },

    updateUI() {
        const userAvatar = document.querySelector('.user .avatar');
        const userInfo = document.querySelector('.user div b');
        const userRole = document.querySelector('.user div small');
        const branchInfo = document.querySelector('.branch strong');
        const btnStockOpname = document.getElementById('btnStockOpname'); // Ambil elemen tombol opname

        if (this.currentUser && userInfo) {
            // Update nama dan inisial di pojok kanan atas
            userAvatar.textContent = this.currentUser.name.substring(0, 2).toUpperCase();
            userInfo.textContent = this.currentUser.name;
            userRole.textContent = this.currentUser.role;

            // Update branch name
            if (branchInfo) {
                branchInfo.textContent = this.currentUser.branch_name || 'Global';
            }

            // Superadmin Branch Selection
            if (this.currentUser.role === 'Superadmin') {
                this.renderBranchSelector();
            }

            // Logika menyembunyikan tombol berdasarkan role
            if (btnStockOpname) {
                if (this.currentUser.role === 'Kasir') {
                    btnStockOpname.style.display = 'none'; // Sembunyikan untuk Kasir
                } else {
                    btnStockOpname.style.display = 'inline-block'; // Tampilkan untuk Superadmin/Admin Gudang
                }
            }
        }
    },

    async renderBranchSelector() {
        const branchDiv = document.querySelector('.branch');
        if (!branchDiv || document.getElementById('branchSelect')) return;

        try {
            const response = await fetch(`${this.backendUrl}/branches`);
            const data = await response.json();

            if (response.ok && data.branches) {
                const select = document.createElement('select');
                select.id = 'branchSelect';
                select.className = 'money-input'; // Using existing class for styling
                select.style.margin = '0 0 0 10px';
                select.style.padding = '5px';
                select.style.width = 'auto';

                data.branches.forEach(b => {
                    const option = document.createElement('option');
                    option.value = b.id;
                    option.textContent = b.name;
                    if (b.id === this.currentUser.branch_id) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });

                select.onchange = (e) => {
                    const newBranchId = parseInt(e.target.value);
                    const newBranchName = e.target.options[e.target.selectedIndex].text;

                    this.currentUser.branch_id = newBranchId;
                    this.currentUser.branch_name = newBranchName;

                    localStorage.setItem('ahlinya_session', JSON.stringify(this.currentUser));

                    document.querySelector('.branch strong').textContent = newBranchName;
                    this.showToast(`Cabang aktif diubah ke ${newBranchName}`);

                    // Nanti kita akan panggil fetchProducts berdasarkan cabang
                    // renderProducts();
                };

                // Replace the static text with the dropdown, or append it
                const strongTag = branchDiv.querySelector('strong');
                strongTag.style.display = 'none'; // Hide the static text
                branchDiv.appendChild(select);
            }
        } catch (error) {
            console.error('Failed to load branches', error);
        }
    },


    // Fallback toast jika logic_pos.js belum sempat dimuat
    showToast(msg) {
        if (typeof toast === 'function') {
            toast(msg);
        } else {
            alert(msg);
        }
    }
};

// Jalankan sistem login saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});