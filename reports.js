const FinancialReports = {
    async fetchReports() {
        if (!Auth.currentUser) return;
        const branchId = Auth.currentUser.branch_id;

        try {
            const response = await fetch(`http://localhost:3000/api/reports?branch_id=${branchId}`, {
                headers: {
                    'Authorization': `Bearer ${Auth.currentUser.token}`
                }
            });
            if (response.ok) {
                const data = await response.json();

                const sales = data.total_sales || 0;
                const cashIn = data.total_cash_in || 0;
                const cashOut = data.total_cash_out || 0;
                const net = sales + cashIn - cashOut;

                document.getElementById('reportSales').textContent = rupiah(sales);
                document.getElementById('reportCashIn').textContent = `+ ${rupiah(cashIn)}`;
                document.getElementById('reportCashOut').textContent = `- ${rupiah(cashOut)}`;
                document.getElementById('reportNet').textContent = rupiah(net);

                document.getElementById('financialModal').classList.remove('hidden');
            } else {
                toast('Gagal memuat laporan keuangan');
            }
        } catch (error) {
            console.error('Fetch reports error:', error);
            toast('Terjadi kesalahan jaringan');
        }
    },

    async saveCashFlow() {
        if (!Auth.currentUser) return;

        const type = document.getElementById('cashType').value;
        const amount = parseInt(document.getElementById('cashAmount').value, 10);
        const description = document.getElementById('cashDesc').value.trim();

        if (!amount || amount <= 0) {
            toast('Masukkan nominal yang valid');
            return;
        }

        if (!description) {
            toast('Keterangan tidak boleh kosong');
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/cashflow', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.currentUser.token}`
                },
                body: JSON.stringify({
                    branch_id: Auth.currentUser.branch_id,
                    user_id: Auth.currentUser.id,
                    type,
                    amount,
                    description
                })
            });

            if (response.ok) {
                toast('Arus kas berhasil dicatat');
                document.getElementById('cashAmount').value = '';
                document.getElementById('cashDesc').value = '';
                this.fetchReports(); // Refresh data laporan
            } else {
                toast('Gagal mencatat arus kas');
            }
        } catch (error) {
            console.error('Save cashflow error:', error);
            toast('Terjadi kesalahan jaringan');
        }
    },

    init() {
        const btnReports = document.getElementById('btnFinancialReports');
        const btnSaveCash = document.getElementById('btnSaveCash');

        if (btnReports) {
            btnReports.onclick = () => {
                Auth.requireRole(['Superadmin', 'Kasir'], () => {
                    this.fetchReports();
                });
            };
        }

        if (btnSaveCash) {
            btnSaveCash.onclick = () => {
                Auth.requireRole(['Superadmin', 'Kasir'], () => {
                    this.saveCashFlow();
                });
            };
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        FinancialReports.init();
    }, 500);
});
