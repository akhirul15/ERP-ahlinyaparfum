const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'erp.db');

const db = new sqlite3.Database(dbPath);

const fs = require('fs');

// Read products.js from parent dir
let productsContent = fs.readFileSync('../products.js', 'utf8');

// The file has a map function at the end that we need to remove for parsing.
// We extract just the JSON array.
const startIdx = productsContent.indexOf('[');
const endIdx = productsContent.lastIndexOf(']') + 1;
const jsonStr = productsContent.substring(startIdx, endIdx);

try {
    const products = JSON.parse(jsonStr);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const insertProduct = db.prepare("INSERT OR IGNORE INTO products (code, name, category, base_price) VALUES (?, ?, ?, ?)");

        products.forEach(p => {
            insertProduct.run(p.code, p.name, p.category, p.basePrice);
        });

        insertProduct.finalize();

        // After inserting products, we insert inventory.
        // We'll give branch 1 default stock, and branch 2 slightly different stock
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
    console.error("Error parsing products.js", e);
}
