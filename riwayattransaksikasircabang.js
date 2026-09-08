// --- MODUL: RIWAYAT TRANSAKSI & VOID (KASIR CABANG) ---

const TransactionHistory = {
    historyData: [],

    init() {
        // Jeda untuk memastikan semua skrip utama selesai dimuat
        setTimeout(() => {
            this.attachEvents();
            this.hookFinishPayment();
        }, 300);
    },

    attachEvents() {
        const btnRiwayat = document.getElementById('btnRiwayatTransaksi');
        if (btnRiwayat) {
            btnRiwayat.onclick = () => this.openModal();
        }
    },

    // Metode cerdas untuk mencegat fungsi finishPayment yang sudah ada
    // agar setiap transaksi otomatis tercatat ke dalam historyData
    hookFinishPayment() {
        if (typeof window.finishPayment === 'function') {
            const originalFinishPayment = window.finishPayment;
            
            window.finishPayment = () => {
                // Jalankan fungsi aslinya terlebih dahulu
                originalFinishPayment();
                
                // Ambil data transaksi yang baru saja selesai
                if (typeof state !== 'undefined' && state.lastReceipt) {
                    const exists = this.historyData.find(t => t.id === state.lastReceipt.id);
                    if (!exists) {
                        const newTrx = { 
                            ...state.lastReceipt, 
                            status: 'Completed', 
                            timestamp: new Date() 
                        };
                        // Masukkan ke urutan paling atas
                        this.historyData.unshift(newTrx); 
                    }
                }
            };
        }
    },

    openModal() {
        this.renderTable();
        const modal = document.getElementById('riwayatModal');
        if (modal) modal.classList.remove('hidden');
    },

    renderTable() {
        const tbody = document.getElementById('riwayatTableBody');
        if (!tbody) return;

        if (this.historyData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #8a929e;">Belum ada transaksi yang tercatat di sesi ini.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.historyData.map((trx, index) => {
            const isVoid = trx.status === 'Void';
            const statusColor = isVoid ? '#ef4444' : '#10b981';
            const statusBg = isVoid ? '#fee2e2' : '#d1fae5';

            return `
            <tr style="border-bottom: 1px solid #edf0f3; opacity: ${isVoid ? '0.5' : '1'};">
                <td style="padding: 10px 5px; font-size: 12px; font-weight: bold;">${trx.id}</td>
                <td style="padding: 10px 5px; font-size: 12px;">${trx.timestamp.toLocaleTimeString('id-ID')}</td>
                <td style="padding: 10px 5px; font-size: 12px;">${trx.method}</td>
                <td style="padding: 10px 5px; font-size: 13px; font-weight: bold; text-align: right;">${typeof rupiah === 'function' ? rupiah(trx.total) : trx.total}</td>
                <td style="padding: 10px 5px; text-align: center;">
                    <span style="background: ${statusBg}; color: ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">${trx.status}</span>
                </td>
                <td style="padding: 10px 5px; text-align: center;">
                    ${!isVoid ? `<button class="primary" style="background: #ef4444; padding: 5px 10px; font-size: 10px; margin: 0;" onclick="TransactionHistory.voidTransaction('${trx.id}')">Void</button>` : '-'}
                </td>
            </tr>
            `;
        }).join('');
    },

    voidTransaction(trxId) {
        // Melindungi fungsi void, hanya Superadmin yang diizinkan
        if (typeof Auth !== 'undefined') {
            Auth.requireRole(['Superadmin'], () => {
                this.executeVoid(trxId);
            });
        } else {
            // Fallback jika sistem Auth sedang offline/gagal dimuat
            const pin = prompt('Masukkan PIN Superadmin (123456) untuk melakukan Void:');
            if (pin === '123456') {
                this.executeVoid(trxId);
            } else {
                if (typeof toast === 'function') toast('Gagal: PIN salah atau akses ditolak!');
            }
        }
    },

    executeVoid(trxId) {
        const trxIndex = this.historyData.findIndex(t => t.id === trxId);
        if (trxIndex > -1) {
            // Ubah status transaksi menjadi Void
            this.historyData[trxIndex].status = 'Void';
            
            // Catatan: Jika nanti sudah ada backend database, 
            // script API untuk mengembalikan stok (RESTORE STOCK) dikirimkan dari fungsi ini.
            
            this.renderTable();
            if (typeof toast === 'function') toast(`Transaksi ${trxId} berhasil di-Void.`);
        }
    }
};

// Inisialisasi modul saat dokumen siap
document.addEventListener('DOMContentLoaded', () => {
    TransactionHistory.init();
});