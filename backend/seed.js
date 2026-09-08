const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const dbPath = path.resolve(__dirname, 'erp.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        db.serialize(() => {
            // Seed Branches
            const insertBranch = db.prepare(`INSERT INTO branches (id, name, address) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING`);
            insertBranch.run(1, 'Ayahanda', 'Jl. Ayahanda No. 1');
            insertBranch.run(2, 'Setiabudi', 'Jl. Setiabudi No. 2');
            insertBranch.finalize();

            // Seed Users (Superadmin, Kasir, Admin Gudang)
            const insertUser = db.prepare(`INSERT INTO users (username, password, role, branch_id) VALUES (?, ?, ?, ?)`);

            // Note: Since 'username' is UNIQUE, we check if users exist before seeding
            db.get(`SELECT COUNT(*) AS count FROM users`, (err, row) => {
                if (err) {
                    console.error("Error checking users count:", err.message);
                } else if (row.count === 0) {
                    const saltRounds = 10;
                    const defaultPassword = 'password123'; // Users should change this later

                    bcrypt.hash(defaultPassword, saltRounds, (err, hash) => {
                        if (err) {
                            console.error("Error hashing password:", err);
                            return;
                        }

                        // Superadmin (not tied to a specific branch necessarily, but let's give them branch 1)
                        insertUser.run('superadmin', hash, 'Superadmin', 1);

                        // Kasir for Branch 1 (Ayahanda)
                        insertUser.run('kasir_ayahanda', hash, 'Kasir', 1);

                        // Kasir for Branch 2 (Setiabudi)
                        insertUser.run('kasir_setiabudi', hash, 'Kasir', 2);

                        // Admin Gudang
                        insertUser.run('admin_gudang', hash, 'Admin Gudang', 1);

                        console.log("Database seeded successfully with default users and branches.");
                        insertUser.finalize();
                    });
                } else {
                    console.log("Database already has users, skipping user seed.");
                }
            });
        });
    }
});
