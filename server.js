/**
 * @file server.js
 * @description Express server for the typewriter application.
 * @version 1.2.2
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');
const DEFAULT_DATA = {pages: [], activePageId: null};

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Read all page data from disk and return it.
 *
 * Behaviour:
 *  • If db.json exists, parse and send its contents.
 *  • If it does not exist, create it with an empty structure and return that.
 *
 * @async
 * @param {express.Request}  _req
 * @param {express.Response} res
 */
async function loadDataHandler(_req, res) {
    try {
        const raw = await fs.readFile(DB_PATH, 'utf8');
        res.json(JSON.parse(raw));
    } catch (err) {
        if (err.code === 'ENOENT') {
            await fs.writeFile(DB_PATH, JSON.stringify(DEFAULT_DATA, null, 2));
            return res.json(DEFAULT_DATA);
        }
        console.error('Error reading DB:', err);
        res.status(500).json({message: 'Error loading data.'});
    }
}

/**
 * Persist all page data received in the request body.
 *
 * @async
 * @param {express.Request}  req
 * @param {express.Response} res
 */
async function saveDataHandler(req, res) {
    try {
        await fs.writeFile(DB_PATH, JSON.stringify(req.body, null, 2));
        res.status(200).json({message: 'Data saved.'});
    } catch (err) {
        console.error('Error writing DB:', err);
        res.status(500).json({message: 'Error saving data.'});
    }
}

app.get('/api/data', loadDataHandler);
app.post('/api/data', saveDataHandler);

// serve main page
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});