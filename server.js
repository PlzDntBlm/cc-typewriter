/**
 * @file server.js
 * @description An Express.js server to host the typewriter application and handle data persistence.
 * @version 1.2.0
 */

// Import necessary modules
const express = require('express');
const path = require('path');
const fs = require('fs').promises; // Use the promise-based version of fs

// --- Server Configuration ---
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');

// --- Initialize Express App ---
const app = express();

// --- Middleware ---
// Add middleware to parse JSON request bodies
app.use(express.json());
// Serve static files (HTML, CSS, JS) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes for Data Persistence ---

// GET /api/data - To load all page data
app.get('/api/data', async (req, res) => {
    try {
        // Read data from db.json
        const data = await fs.readFile(DB_PATH, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        // If db.json doesn't exist or is empty, return a default structure
        if (error.code === 'ENOENT') {
            const defaultData = {pages: [], activePageId: null};
            // Create the file with default data for future requests
            await fs.writeFile(DB_PATH, JSON.stringify(defaultData, null, 2));
            return res.json(defaultData);
        }
        // For other errors, send a server error response
        console.error('Error reading from database:', error);
        res.status(500).json({message: 'Error loading data.'});
    }
});

// POST /api/data - To save all page data
app.post('/api/data', async (req, res) => {
    try {
        const data = req.body;
        // Write the new data to db.json, formatting it for readability
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
        res.status(200).json({message: 'Data saved successfully.'});
    } catch (error) {
        console.error('Error writing to database:', error);
        res.status(500).json({message: 'Error saving data.'});
    }
});

// --- Main Route ---
// The main route now implicitly serves index.html from the 'public' directory
// so this specific route is no longer needed. If you want to be explicit, you can keep it:
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});