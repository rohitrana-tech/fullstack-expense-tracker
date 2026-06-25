const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// GET Route: Fetch all transactions
app.get('/api/transactions', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM transactions ORDER BY transaction_date DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// POST Route: Add a new transaction
app.post('/api/transactions', async (req, res) => {
    try {
        const { description, amount, type, category, date } = req.body;
        const newTransaction = await pool.query(
            'INSERT INTO transactions (description, amount, type, category, transaction_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [description, amount, type, category, date]
        );
        res.json(newTransaction.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// DELETE Route: Remove a transaction
app.delete('/api/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM transactions WHERE id = $1', [id]);
        res.json({ message: "Transaction deleted" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});