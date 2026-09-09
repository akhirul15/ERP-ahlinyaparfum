const rupiah = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
const state = {
  query: '',
  category: 'Semua',
  cart: [],
  member: null,
  pointsUsed: 0,
  discountRate: 0,
  variantProduct: null,
  qty: 1,
  paymentMethod: 'Cash',
  lastReceipt: null
};

const $ = s => document.querySelector(s);
let products = [];
let categories = ['Semua'];

async function fetchProducts() {
  const branchId = Auth.currentUser ? Auth.currentUser.branch_id : 1;
  try {
    const response = await fetch(`http://localhost:3000/api/products?branch_id=${branchId}`);
    const data = await response.json();
    if (response.ok) {
      if (typeof processProductsCategories === 'function') {
        products = processProductsCategories(data.products);
      } else {
        products = data.products;
      }
      window.PRODUCTS = products;
      categories = ['Semua', ...new Set(products.map(p=>p.category).filter(Boolean))];
      renderCategories();
      renderProducts();
    }
  } catch (error) {
    console.error('Failed to fetch products', error);
  }
}

function renderCategories(){
  $('#categoryChips').innerHTML = categories.map(c=>`<button class="chip ${state.category===c?'active':''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
  document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{state.category=b.dataset.cat;renderCategories();renderProducts()});
}

function filtered(){
  const q = state.query.toLowerCase().trim();
  return products.filter(p=>(state.category==='Semua'||p.category===state.category)&&(!q||`${p.name} ${p.code} ${p.category}`.toLowerCase().includes(q))).slice(0,60);
}

function renderProducts(){
  const list=filtered();
  $('#resultCount').textContent=`${list.length}${filtered().length===60?'+':''} produk`;
  $('#productList').innerHTML=list.map(p=>`
    <article class="product">
      <div class="cat">${escapeHtml(p.category)} • #${escapeHtml(p.code)}</div>
      <h3>${escapeHtml(p.name)}</h3>
      <div class="bottom">
        <div><div class="price">mulai ${rupiah(p.basePrice)}/ml</div><div class="stock">Stok ${p.stock}</div></div>
        <button class="add" data-product="${p.code}">+</button>
      </div>
    </article>`).join('');
  document.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>openVariant(products.find(p=>p.code===b.dataset.product)));
}

function openVariant(p){
  state.variantProduct = p;
  state.qty = 1;
  $('#qtyValue').textContent = 1;
  $('#variantTitle').textContent = p.name;
  
  // Kosongkan input mili setiap buka produk baru
  const volumeInput = $('#volumeInput');
  if(volumeInput) {
    volumeInput.value = ''; 
    updateVariantPrice();
  }
  
  $('#variantModal').classList.remove('hidden');
  
  // Otomatis fokus ke kolom input supaya kasir bisa langsung mengetik
  setTimeout(() => { if($('#volumeInput')) $('#volumeInput').focus(); }, 100);
}

// Pendeteksi ketikan. Setiap kali angka berubah, harga terupdate
if($('#volumeInput')) {
  $('#volumeInput').oninput = () => {
    updateVariantPrice();
  };
  // Tambahkan event listener Enter untuk langsung menambah ke keranjang
  $('#volumeInput').onkeydown = (e) => {
    if(e.key === 'Enter') {
      e.preventDefault();
      addVariant();
    }
  };
}

function updateVariantPrice(){
  const p = state.variantProduct;
  if(!p) return;
  
  const ml = parseInt($('#volumeInput').value, 10) || 0;
  
  // Kalkulasi harga: Harga Dasar (per mili) x Jumlah Mili
  const price = Math.round(p.basePrice * ml); 
  
  $('#variantPrice').textContent = rupiah(price);
}

function addVariant(){
  const p = state.variantProduct;
  if(!p) return;
  
  const ml = parseInt($('#volumeInput').value, 10) || 0;
  if (ml <= 0) {
      toast('Masukkan jumlah mili terlebih dahulu!');
      return;
  }

  const unitPrice = parseInt($('#variantPrice').textContent.replace(/[^\d]/g,''), 10) || 0;
  const key = [p.code, ml].join('|');
  const found = state.cart.find(x => x.key === key);
  
  if(found) {
    found.qty += state.qty;
  } else {
    state.cart.push({
      key: key,
      code: p.code,
      name: p.name,
      price: unitPrice,
      qty: state.qty,
      volume: ml
    });
  }
  
  $('#variantModal').classList.add('hidden');
  renderCart();
  toast('Produk ditambahkan ke keranjang');
}

function renderCart(){
  const el = $('#cartItems');
  $('#emptyCart').classList.toggle('hidden', state.cart.length > 0);
  
  el.innerHTML = state.cart.map((x, i) => `
    <div class="cart-row">
      <div class="cart-row-top">
        <div>
          <div class="cart-name">${escapeHtml(x.name)}</div>
          <div class="variant-meta">Ukuran: ${x.volume} ml</div>
        </div>
        <b>${rupiah(x.price * x.qty)}</b>
      </div>
      <div class="cart-row-bottom">
        <div class="qty">
          <button data-dec="${i}">−</button>
          <b>${x.qty}</b>
          <button data-inc="${i}">+</button>
        </div>
        <button class="remove" data-remove="${i}">Hapus</button>
      </div>
    </div>`).join('');
    
  document.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => changeQty(+b.dataset.dec, -1));
  document.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => changeQty(+b.dataset.inc, 1));
  document.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => {
    state.cart.splice(+b.dataset.remove, 1);
    renderCart();
  });
  
  const count = state.cart.reduce((s, x) => s + x.qty, 0);
  $('#cartCount').textContent = `${count} item`;
  updateSummary();
}

function changeQty(i, d){
  state.cart[i].qty += d;
  if(state.cart[i].qty <= 0) state.cart.splice(i, 1);
  renderCart();
}

function updateSummary(){
  const sub = state.cart.reduce((s, x) => s + x.price * x.qty, 0);
  const discount = Math.round(sub * state.discountRate);
  const pointDiscount = Math.min(state.pointsUsed * 100, Math.max(0, sub - discount));
  const total = Math.max(0, sub - discount - pointDiscount);
  
  $('#subtotal').textContent = rupiah(sub);
  $('#discount').textContent = `- ${rupiah(discount)}`;
  $('#pointsDiscount').textContent = `- ${rupiah(pointDiscount)}`;
  $('#total').textContent = rupiah(total);
  $('#payTotal').textContent = rupiah(total);
  $('#checkoutTotal').textContent = rupiah(total);
}

function useMember(){
  const q = $('#memberInput').value.trim();
  if(!q){toast('Masukkan nama atau nomor member');return}
  state.member = {name: q, code: 'MBR-001', points: 1280, level: 'Gold'};
  state.discountRate = .05;
  $('#memberInfo').classList.remove('hidden');
  $('#memberInfo').innerHTML = `<b>${escapeHtml(q)}</b> • Gold • 1.280 poin <br><span>Diskon member 5% aktif</span>`;
  updateSummary();
  toast('Member berhasil digunakan');
}

function checkout(){
  if(!state.cart.length){toast('Keranjang masih kosong');return}
  $('#paymentModal').classList.remove('hidden');
  updateSummary();
  $('#cashReceived').value = '';
  $('#change').textContent = rupiah(0);
  setTimeout(() => { if($('#cashReceived')) $('#cashReceived').focus(); }, 100);
}

function finishPayment(){
  const total = parseInt($('#total').textContent.replace(/[^\d]/g,''), 10) || 0;
  const received = state.paymentMethod === 'Cash' ? (parseInt($('#cashReceived').value, 10) || 0) : total;
  
  if(state.paymentMethod === 'Cash' && received < total){
    toast('Nominal diterima kurang');
    return;
  }
  
  const id = 'TRX-' + Date.now();
  const change = Math.max(0, received - total);
  state.lastReceipt = {id, total, received, change, method: state.paymentMethod, items: [...state.cart], member: state.member};
  
  // Reset setelah bayar
  state.cart = [];
  state.pointsUsed = 0;
  state.member = null;
  state.discountRate = 0;
  $('#memberInput').value = '';
  $('#memberInfo').classList.add('hidden');
  
  $('#paymentModal').classList.add('hidden');
  renderReceipt();
  $('#receiptModal').classList.remove('hidden');
  renderCart();
  toast('Transaksi berhasil disimpan');
}

function renderReceipt(){
  const r = state.lastReceipt;
  $('#receiptPreview').innerHTML = `
    <div class="receipt-title">AHLINYA PARFUM</div>
    <div style="text-align:center">Struk Penjualan</div>
    <div class="receipt-line"></div>
    <div>No: ${r.id}</div>
    <div>Kasir: Kasir Utama</div>
    <div>Waktu: ${new Date().toLocaleString('id-ID')}</div>
    <div class="receipt-line"></div>
    ${r.items.map(x => `<div class="receipt-item"><span>${escapeHtml(x.name)} (${x.volume}ml)<br>${x.qty} × ${rupiah(x.price)}</span><b>${rupiah(x.qty * x.price)}</b></div>`).join('')}
    <div class="receipt-line"></div>
    <div class="receipt-total"><span>TOTAL</span><span>${rupiah(r.total)}</span></div>
    <div>Pembayaran: ${r.method}</div>
    <div>Diterima: ${rupiah(r.received)}</div>
    <div>Kembalian: ${rupiah(r.change)}</div>
    <div class="receipt-line"></div>
    <div style="text-align:center">Terima kasih telah berbelanja.</div>`;
}

function printReceipt(){
  if(!state.lastReceipt) return;
  const content = $('#receiptPreview').innerHTML;
  const w = window.open('','_blank','width=420,height=700');
  w.document.write(`<html><head><title>Resi ${state.lastReceipt.id}</title><style>body{font-family:monospace;width:72mm;margin:8mm auto;font-size:11px}.receipt-title{text-align:center;font-weight:800;font-size:15px}.receipt-line{border-top:1px dashed #777;margin:10px 0}.receipt-item,.receipt-total{display:flex;justify-content:space-between;gap:8px;margin:6px 0}.receipt-total{font-weight:800}</style></head><body>${content}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 200);
}

function digitalReceipt(){
  const r = state.lastReceipt;
  if(!r) return;
  const text = `AHLINYA PARFUM\nResi: ${r.id}\nTotal: ${rupiah(r.total)}\nPembayaran: ${r.method}\nTerima kasih.`;
  const blob = new Blob([text], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `resi-${r.id}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Resi digital dibuat');
}

function sendWhatsapp(){
  const r = state.lastReceipt;
  if(!r) return;
  const phone = prompt('Nomor WhatsApp pelanggan (contoh 62812xxxx):');
  if(!phone) return;
  const text = encodeURIComponent(`*AHLINYA PARFUM*\nResi: ${r.id}\nTotal: ${rupiah(r.total)}\nPembayaran: ${r.method}\nTerima kasih sudah berbelanja.`);
  window.open(`https://wa.me/${phone.replace(/\D/g,'')}?text=${text}`, '_blank');
}

function sendEmail(){
  const r = state.lastReceipt;
  if(!r) return;
  const email = prompt('Email pelanggan:');
  if(!email) return;
  const subject = encodeURIComponent(`Resi AhlinyaParfum ${r.id}`);
  const body = encodeURIComponent(`Halo, berikut resi transaksi Anda.\n\nNo: ${r.id}\nTotal: ${rupiah(r.total)}\nPembayaran: ${r.method}\n\nTerima kasih.`);
  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
}

function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => t.classList.add('hidden'), 2200);
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

// === EVENT LISTENERS ===
$('#search').oninput = e => { state.query = e.target.value; renderProducts(); };
document.addEventListener('keydown', e => { if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#search').focus(); } });

$('#clearCart').onclick = () => { state.cart = []; renderCart(); };
$('#useMember').onclick = useMember;
$('#findMember').onclick = () => $('#memberInput').focus();
$('#payBtn').onclick = checkout;
$('#finishPay').onclick = finishPayment;

if($('#cashReceived')) {
  $('#cashReceived').oninput = () => {
    const total = parseInt($('#total').textContent.replace(/[^\d]/g,''), 10) || 0;
    const r = parseInt($('#cashReceived').value, 10) || 0;
    $('#change').textContent = rupiah(Math.max(0, r - total));
  };
}

$('#addVariant').onclick = addVariant;


document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $('#' + b.dataset.close).classList.add('hidden'));

document.querySelectorAll('.pay-method').forEach(b => b.onclick = () => {
  state.paymentMethod = b.dataset.method;
  document.querySelectorAll('.pay-method').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
});

$('#printReceipt').onclick = printReceipt;
$('#digitalReceipt').onclick = digitalReceipt;
$('#sendWhatsapp').onclick = sendWhatsapp;
$('#sendEmail').onclick = sendEmail;

// Inisialisasi awal
fetchProducts();
renderCart();