require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { authenticateToken } = require('./middleware');

const app = express();
const port = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here'; // In production, use environment variables

app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running' });
});

// Authentication Endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    const query = `
        SELECT u.id, u.username, u.password, u.role, u.branch_id, b.name as branch_name
        FROM users u
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE u.username = ?
    `;

    db.get(query, [username], (err, user) => {
        if (err) {
            console.error('Database error during login:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error('Bcrypt error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid username or password.' });
            }

            const payload = {
                id: user.id,
                username: user.username,
                role: user.role,
                branch_id: user.branch_id,
                branch_name: user.branch_name
            };

            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

            res.json({
                message: 'Login successful',
                token,
                user: payload
            });
        });
    });
});

// Get all branches endpoint
app.get('/api/branches', authenticateToken, (req, res) => {
    db.all(`SELECT id, name FROM branches`, (err, rows) => {
        if (err) {
            console.error('Error fetching branches:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json({ branches: rows });
    });
});

// Get products endpoint
app.get('/api/products', authenticateToken, (req, res) => {
    const branch_id = req.query.branch_id;

    let query = `
        SELECT p.id, p.code, p.name, p.category, p.base_price,
               IFNULL(ib.stock, 0) as stock
        FROM products p
    `;
    let params = [];

    if (branch_id) {
        query += ` LEFT JOIN inventory_branch ib ON p.id = ib.product_id AND ib.branch_id = ?`;
        params.push(branch_id);
    } else {
        query += ` LEFT JOIN inventory_branch ib ON p.id = ib.product_id AND ib.branch_id = 1`; // Default to branch 1 if none provided
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        // Map to match frontend expected structure
        const formattedRows = rows.map(row => ({
            code: row.code,
            name: row.name,
            category: row.category,
            basePrice: row.base_price,
            stock: row.stock
        }));

        res.json({ products: formattedRows });
    });
});


// Create a new transaction
app.post('/api/transactions', authenticateToken, (req, res) => {
    const { id, branch_id, user_id, customer_id, total, received, change, method, items } = req.body;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const insertTrx = db.prepare(`
            INSERT INTO transactions (id, branch_id, user_id, customer_id, total, received, change, payment_method, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Completed')
        `);

        insertTrx.run(id, branch_id, user_id, customer_id || null, total, received, change, method, function(err) {
            if (err) {
                console.error("Error inserting transaction", err);
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to insert transaction' });
            }
        });
        insertTrx.finalize();

        const insertItem = db.prepare(`
            INSERT INTO transaction_items (transaction_id, product_id, qty, volume, price)
            VALUES (?, (SELECT id FROM products WHERE code = ?), ?, ?, ?)
        `);

        const updateStock = db.prepare(`
            UPDATE inventory_branch
            SET stock = stock - ?
            WHERE branch_id = ? AND product_id = (SELECT id FROM products WHERE code = ?)
        `);

        for (const item of items) {
            insertItem.run(id, item.code, item.qty, item.volume, item.price);
            updateStock.run(item.qty, branch_id, item.code);
        }

        insertItem.finalize();
        updateStock.finalize();

        db.run('COMMIT', (err) => {
            if (err) {
                console.error("Error committing transaction", err);
                return res.status(500).json({ error: 'Failed to commit transaction' });
            }
            res.json({ message: 'Transaction saved successfully' });
        });
    });
});

// Record Cash Flow (In/Out)
app.post('/api/cashflow', authenticateToken, (req, res) => {
    const { branch_id, user_id, type, amount, description } = req.body;

    if (!['IN', 'OUT'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Must be IN or OUT.' });
    }

    db.run(
        `INSERT INTO cash_flow (branch_id, user_id, type, amount, description) VALUES (?, ?, ?, ?, ?)`,
        [branch_id, user_id, type, amount, description],
        function(err) {
            if (err) {
                console.error("Error inserting cash flow", err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            res.json({ message: 'Cash flow recorded successfully', id: this.lastID });
        }
    );
});

// Get Financial Reports
app.get('/api/reports', authenticateToken, (req, res) => {
    const branch_id = req.query.branch_id;
    let params = [];
    let branchFilter = '';

    if (branch_id) {
        branchFilter = 'WHERE branch_id = ? AND';
        params.push(branch_id);
    } else {
        branchFilter = 'WHERE';
    }

    // Since we need to run multiple queries, we'll nest them (not ideal, but works for sqlite locally)
    const report = {
        total_sales: 0,
        total_cash_in: 0,
        total_cash_out: 0
    };

    db.get(`SELECT SUM(total) as total_sales FROM transactions ${branchFilter} status = 'Completed'`, params, (err, row) => {
        if (row && row.total_sales) report.total_sales = row.total_sales;

        db.get(`SELECT SUM(amount) as total_in FROM cash_flow ${branchFilter} type = 'IN'`, params, (err, rowIn) => {
            if (rowIn && rowIn.total_in) report.total_cash_in = rowIn.total_in;

            db.get(`SELECT SUM(amount) as total_out FROM cash_flow ${branchFilter} type = 'OUT'`, params, (err, rowOut) => {
                if (rowOut && rowOut.total_out) report.total_cash_out = rowOut.total_out;

                res.json(report);
            });
        });
    });
});

app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});
