const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'erp.db');

const db = new sqlite3.Database(dbPath);

const fs = require('fs');

try {
    let productsContent = fs.readFileSync('../products_old.json', 'utf8');
    const startIdx = productsContent.indexOf('[');
    const endIdx = productsContent.lastIndexOf(']') + 1;
    const jsonStr = productsContent.substring(startIdx, endIdx);
    const products = JSON.parse(jsonStr);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const insertProduct = db.prepare("INSERT OR IGNORE INTO products (code, name, category, base_price) VALUES (?, ?, ?, ?)");

        products.forEach(p => {
            insertProduct.run(p.code, p.name, p.category, p.basePrice);
        });

        insertProduct.finalize();

        const insertInventory = db.prepare(`
            INSERT OR IGNORE INTO inventory_branch (product_id, branch_id, stock)
            SELECT id, ?, ? FROM products WHERE code = ?
        `);

        products.forEach(p => {
            insertInventory.run(1, p.stock, p.code); // Branch 1 gets original stock
            insertInventory.run(2, p.stock + 10, p.code); // Branch 2 gets stock + 10
        });

        insertInventory.finalize();

        db.run("COMMIT", (err) => {
            if(err) console.error("Error committing:", err);
            else console.log("Successfully seeded products and inventory.");
            db.close();
        });
    });
} catch(e) {
    console.error("Error parsing products", e);
}
