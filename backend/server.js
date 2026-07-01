const { GoogleGenerativeAI } = require('@google/generative-ai');
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

// PUT Route: Update an existing transaction (Add this now)
app.put('/api/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { description, amount, type, category } = req.body;
        
        const updatedTransaction = await pool.query(
            'UPDATE transactions SET description = $1, amount = $2, type = $3, category = $4 WHERE id = $5 RETURNING *',
            [description, amount, type, category, id]
        );

        if (updatedTransaction.rows.length === 0) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        res.json(updatedTransaction.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

const PORT = process.env.PORT || 5000;

// POST Route: Real AI Financial Analysis
app.post('/api/analyze', async (req, res) => {
    try {
        const { transactions, balance, income, expenses } = req.body;

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        // Format the transactions so the AI can read them easily
        const ledgerSummary = transactions.map(t => 
            `${t.date}: ${t.type} of ₹${t.amount} for ${t.category} (${t.description})`
        ).join('\n');

        // The System Prompt telling the AI how to behave
        const prompt = `
            You are an expert, strict, and highly analytical personal finance advisor.
            Analyze this user's current financial snapshot:
            - Total Income: ₹${income}
            - Total Expenses: ₹${expenses}
            - Current Balance: ₹${balance}
            
            Recent Ledger:
            ${ledgerSummary}
            
            Based on this specific data, provide exactly 3 highly actionable, distinct pieces of advice. 
            Do not use generic fluff. Point out specific spending habits, category concentrations, or cash flow risks you see in the ledger.
            Return your answer STRICTLY as a JSON array of 3 strings. Do not include markdown formatting or backticks.
            Example format: ["Advice 1", "Advice 2", "Advice 3"]
        `;

        const result = await model.generateContent(prompt);
        const aiResponse = result.response.text();
        
        // Clean the response to ensure it parses as JSON safely
        const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const insightsArray = JSON.parse(cleanJson);

        res.json({ insights: insightsArray });

    } catch (err) {
        console.error("AI Generation Error:", err);
        res.status(500).json({ error: "Failed to generate AI insights" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});