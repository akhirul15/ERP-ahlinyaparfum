// --- MODUL: STOCK OPNAME & CRUD VARIAN (KASIR) ---

const StockOpname = {
    opnameData: [],

    init() {
        setTimeout(() => {
            this.attachEvents();
        }, 300);
    },

    attachEvents() {
        const btnOpname = document.getElementById('btnStockOpname');
        const btnSimpan = document.getElementById('btnSimpanOpname');
        const btnAddProduct = document.getElementById('btnAddNewProduct'); // Pemicu tambah varian baru

        if (btnOpname) {
            btnOpname.onclick = () => {
                if (typeof Auth !== 'undefined') {
                    // HANYA MODIFIKASI BARIS INI: Tambahkan 'Admin Gudang' dan hapus 'Kasir'
                    Auth.requireRole(['Superadmin', 'Admin Gudang'], () => {
                        this.openModal();
                    });
                } else {
                    this.openModal();
                }
            };
        }

        if (btnSimpan) {
            btnSimpan.onclick = () => this.submitOpname();
        }

        if (btnAddProduct) {
            btnAddProduct.onclick = () => this.addNewProduct();
        }
    },

    openModal() {
        const productList = window.PRODUCTS || products || [];

        this.opnameData = productList.map(p => ({
            code: p.code,
            name: p.name,
            systemStock: p.stock,
            physicalStock: p.stock
        }));

        this.renderTable();

        const modal = document.getElementById('opnameModal');
        if (modal) modal.classList.remove('hidden');
    },

    renderTable() {
        const tbody = document.getElementById('opnameTableBody');
        if (!tbody) return;

        tbody.innerHTML = this.opnameData.map((item, index) => {
            const selisih = item.physicalStock - item.systemStock;
            const selisihColor = selisih < 0 ? '#ef4444' : (selisih > 0 ? '#10b981' : '#68717e');

            return `
            <tr style="border-bottom: 1px solid #edf0f3;">
                <td style="padding: 10px 5px; font-size: 11px; color: #8a929e;">#${item.code}</td>
                <td style="padding: 10px 5px; font-size: 13px; font-weight: 700;">${item.name}</td>
                <td style="padding: 10px 5px; font-size: 13px; text-align: center;">${item.systemStock}</td>
                <td style="padding: 10px 5px;">
                    <input type="number" class="money-input opname-input" data-index="${index}" value="${item.physicalStock}" min="0" style="margin:0; width: 100%; padding: 8px; text-align: center;">
                </td>
                <td style="padding: 10px 5px; font-weight: bold; font-size: 13px; color: ${selisihColor}; text-align: right;" id="selisih-${index}">
                    ${selisih > 0 ? '+' : ''}${selisih}
                </td>
            </tr>
            `;
        }).join('');

        document.querySelectorAll('.opname-input').forEach(input => {
            input.oninput = (e) => this.handleInput(e);
        });
    },

    handleInput(e) {
        const index = e.target.dataset.index;
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 0) val = 0;

        this.opnameData[index].physicalStock = val;

        const item = this.opnameData[index];
        const selisih = item.physicalStock - item.systemStock;

        const selisihTd = document.getElementById(`selisih-${index}`);
        if (selisihTd) {
            selisihTd.textContent = `${selisih > 0 ? '+' : ''}${selisih}`;
            selisihTd.style.color = selisih < 0 ? '#ef4444' : (selisih > 0 ? '#10b981' : '#68717e');
        }
    },

    // --- POSISI TEPAT submitOpname() ---
    submitOpname() {
        const productList = window.PRODUCTS || products || [];
        let updatedCount = 0;

        this.opnameData.forEach(op => {
            if (op.physicalStock !== op.systemStock) {
                const target = productList.find(p => p.code === op.code);
                if (target) {
                    target.stock = op.physicalStock;
                    updatedCount++;
                }
            }
        });

        const modal = document.getElementById('opnameModal');
        if (modal) modal.classList.add('hidden');

        if (typeof renderProducts === 'function') {
            renderProducts();
        }

        if (typeof toast === 'function') {
            toast(`Stock Opname selesai! ${updatedCount} produk disesuaikan.`);
        }
    }, // <-- PERHATIKAN KOMA INI SANGAT PENTING

    // --- POSISI TEPAT addNewProduct() ---
    addNewProduct() {
        const code = document.getElementById('newProdCode').value.trim();
        const name = document.getElementById('newProdName').value.trim();
        const category = document.getElementById('newProdCat').value;
        const price = parseInt(document.getElementById('newProdPrice').value, 10);

        if (!code || !name || isNaN(price)) {
            if (typeof toast === 'function') toast('Harap isi kode, nama, dan harga!');
            return;
        }

        const productList = window.PRODUCTS || products || [];

        if (productList.some(p => p.code === code)) {
            if (typeof toast === 'function') toast('Kode produk sudah ada!');
            return;
        }

        const newProduct = {
            code: code,
            name: name,
            category: category,
            basePrice: price,
            stock: 0
        };

        productList.push(newProduct);

        this.opnameData.unshift({
            code: newProduct.code,
            name: newProduct.name,
            systemStock: newProduct.stock,
            physicalStock: newProduct.stock
        });

        document.getElementById('newProdCode').value = '';
        document.getElementById('newProdName').value = '';
        document.getElementById('newProdPrice').value = '';

        this.renderTable();
        if (typeof renderProducts === 'function') renderProducts();

        if (typeof toast === 'function') toast(`Berhasil menambahkan ${name}!`);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    StockOpname.init();
});