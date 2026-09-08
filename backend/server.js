require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

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
app.get('/api/branches', (req, res) => {
    db.all(`SELECT id, name FROM branches`, (err, rows) => {
        if (err) {
            console.error('Error fetching branches:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json({ branches: rows });
    });
});

app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});
