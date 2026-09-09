window.PRODUCTS = [];

// Removed hardcoded product array because it is now fetched from backend API.

// --- MODUL: STANDARISASI KATEGORI & SATUAN ---
function processProductsCategories(productsList) {
    return productsList.map(p => {
        let newCategory = "Produk (pcs)"; // Default awal
        const cat = p.category ? p.category.toUpperCase() : "";

        // Logika pengelompokan kategori
        if (cat.includes("REFILL") || cat === "ML") {
            newCategory = "Refill (ml)";
        } else if (cat.includes("BOTOL")) {
            newCategory = "Botol (pcs)";
        } else if (cat.includes("PRODUK") || cat === "PCS" || cat === "LAINNYA") {
            newCategory = "Produk (pcs)";
        }

        return { ...p, category: newCategory };
    });
}
