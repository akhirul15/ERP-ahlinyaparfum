const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running' });
});

app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});
