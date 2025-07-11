/**
 * @file server.js
 * @description A simple Express.js server to host the typewriter application.
 * @version 1.0.0
 */

// Import necessary modules
const express = require('express');
const path = require('path');

// --- Server Configuration ---
const PORT = process.env.PORT || 3000;

// --- Initialize Express App ---
const app = express();

// --- Middleware ---
// Serve static files (HTML, CSS, JS) from the 'public' directory
// We will assume index.html, app.js, and styles.css are in the root for now.
app.use(express.static(path.join(__dirname, '/')));

// --- Routes ---
// A simple root route to ensure the server is working
app.get('/', (req, res) => {
    // The express.static middleware will automatically serve index.html for the '/' route
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop the server.');
});

// --- Error Handling (Basic) ---
app.on('error', (error) => {
    console.error('Server error:', error);
});
