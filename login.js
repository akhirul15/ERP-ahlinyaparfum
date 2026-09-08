// --- MODUL: HAK AKSES & LOGIN ---

const Auth = {
    // Simulasi data user sementara. Nanti data ini ditarik dari tabel 'users' di database
    users: [
        { id: 1, username: 'admin', pin: '123456', role: 'Superadmin', name: 'Bpk. Owner' },
        { id: 2, username: 'admingudang', pin: '123456', role: 'Admin Gudang', name: 'Tim Gudang' },
        { id: 3, username: 'gojo', pin: '123456', role: 'Kasir', name: 'Gojokasir1' },
        { id: 4, username: 'jogo', pin: '123456', role: 'Kasir', name: 'Jogokasir2' }
    ],

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

    processLogin() {
        const username = document.getElementById('loginUsername').value.trim().toLowerCase();
        const pin = document.getElementById('loginPin').value.trim();

        if (!username || !pin) {
            this.showToast('Harap isi username dan PIN');
            return;
        }

        // Cari pencocokan data user
        const user = this.users.find(u => u.username === username && u.pin === pin);
        
        if (user) {
            this.currentUser = { id: user.id, username: user.username, role: user.role, name: user.name };
            
            // Simpan sesi ke localStorage agar tidak perlu login terus saat refresh
            localStorage.setItem('ahlinya_session', JSON.stringify(this.currentUser));
            
            this.hideLoginModal();
            this.updateUI();
            this.showToast(`Selamat datang, ${user.name} (${user.role})`);
            
            // Kosongkan form login untuk keamanan
            document.getElementById('loginUsername').value = '';
            document.getElementById('loginPin').value = '';
        } else {
            this.showToast('Username atau PIN salah!');
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
        const btnStockOpname = document.getElementById('btnStockOpname'); // Ambil elemen tombol opname
        
        if (this.currentUser && userInfo) {
            // Update nama dan inisial di pojok kanan atas
            userAvatar.textContent = this.currentUser.name.substring(0, 2).toUpperCase();
            userInfo.textContent = this.currentUser.name;
            userRole.textContent = this.currentUser.role;

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