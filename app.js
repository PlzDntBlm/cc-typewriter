/**
 * @file app.js
 * @description Main javascript for the smart local storage typewriter application.
 * @version 1.1.0
 */

/**
 * Represents the main application controller.
 * @class
 */
class TypewriterApp {
    /**
     * Initializes the application, setting up DOM elements and event listeners.
     */
    constructor() {
        // Core editor elements
        this.pageTitle = document.getElementById('page-title');
        this.editor = document.getElementById('editor');

        // Sidebar and page management elements
        this.pageList = document.getElementById('page-list');
        this.newPageBtn = document.getElementById('new-page-btn');

        // Application state
        this.activePageId = null;
        this.pages = {};

        this.init();
    }

    /**
     * @private
     * Main initialization function.
     */
    init() {
        this.setupEventListeners();
        this.loadState();
        this.renderPageList();
        this.loadActivePage();
        this.handleEditorBlur(); // Set initial placeholder state
    }

    /**
     * @private
     * Sets up all necessary event listeners for the application.
     */
    setupEventListeners() {
        // Autosave on input for both title and editor
        this.pageTitle.addEventListener('input', () => this.saveActivePage());
        this.editor.addEventListener('input', () => this.saveActivePage());

        // Handle placeholder for contenteditable div
        this.editor.addEventListener('focus', this.handleEditorFocus);
        this.editor.addEventListener('blur', this.handleEditorBlur.bind(this));

        // New page button
        this.newPageBtn.addEventListener('click', () => this.createNewPage());

        // Use event delegation for page list clicks
        this.pageList.addEventListener('click', (event) => {
            const pageElement = event.target.closest('.page-item');
            if (pageElement && pageElement.dataset.pageId) {
                this.switchActivePage(pageElement.dataset.pageId);
            }
        });
    }

    /**
     * Saves the entire application state (all pages and active page ID) to localStorage.
     * @private
     */
    saveState() {
        try {
            localStorage.setItem('typewriter-pages', JSON.stringify(this.pages));
            localStorage.setItem('typewriter-activePageId', this.activePageId);
        } catch (error) {
            console.error("Error saving state to local storage:", error);
        }
    }

    /**
     * Loads the application state from localStorage.
     * @private
     */
    loadState() {
        try {
            const savedPages = localStorage.getItem('typewriter-pages');
            const savedActivePageId = localStorage.getItem('typewriter-activePageId');

            this.pages = savedPages ? JSON.parse(savedPages) : {};
            this.activePageId = savedActivePageId || null;

            // If no pages exist, create an initial one
            if (Object.keys(this.pages).length === 0) {
                this.createNewPage(false); // don't save state yet
            }

            // If there's no active page ID, set it to the first available page
            if (!this.activePageId || !this.pages[this.activePageId]) {
                this.activePageId = Object.keys(this.pages)[0];
            }

        } catch (error) {
            console.error("Error loading state from local storage:", error);
            this.pages = {};
            this.activePageId = null;
        }
    }

    /**
     * Saves the content of the currently active page to the state object.
     * @returns {void}
     */
    saveActivePage() {
        if (!this.activePageId) return;

        const pageData = {
            title: this.pageTitle.value,
            content: this.editor.innerHTML,
            lastModified: new Date().toISOString()
        };

        this.pages[this.activePageId] = pageData;

        // Update the title in the sidebar in real-time
        const activePageElement = this.pageList.querySelector(`[data-page-id="${this.activePageId}"]`);
        if (activePageElement) {
            activePageElement.textContent = pageData.title || 'Untitled Page';
        }

        this.saveState();
        console.log(`Page ${this.activePageId} saved.`);
    }

    /**
     * Loads a page's data into the editor fields.
     * @private
     */
    loadActivePage() {
        if (!this.activePageId || !this.pages[this.activePageId]) {
            console.warn("Could not load active page, ID not found:", this.activePageId);
            this.clearEditor();
            return;
        }

        const pageData = this.pages[this.activePageId];
        this.pageTitle.value = pageData.title || '';
        this.editor.innerHTML = pageData.content || '';

        this.updateActivePageInList();
        this.handleEditorBlur(); // Update placeholder visibility
    }

    /**
     * Clears the editor and title fields.
     * @private
     */
    clearEditor() {
        this.pageTitle.value = '';
        this.editor.innerHTML = '';
        this.handleEditorBlur();
    }

    /**
     * Renders the list of pages in the sidebar.
     * @private
     */
    renderPageList() {
        this.pageList.innerHTML = ''; // Clear existing list
        const pageIds = Object.keys(this.pages);

        if (pageIds.length === 0) {
            this.pageList.innerHTML = '<p class="text-stone-500">No pages yet.</p>';
            return;
        }

        pageIds.forEach(id => {
            const page = this.pages[id];
            const pageElement = document.createElement('div');
            pageElement.dataset.pageId = id;
            pageElement.className = 'page-item p-2 rounded cursor-pointer hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors duration-150';
            pageElement.textContent = page.title || 'Untitled Page';
            this.pageList.appendChild(pageElement);
        });

        this.updateActivePageInList();
    }

    /**
     * Highlights the currently active page in the sidebar.
     * @private
     */
    updateActivePageInList() {
        // Remove active class from all items
        this.pageList.querySelectorAll('.page-item').forEach(el => {
            el.classList.remove('bg-blue-500', 'text-white');
        });

        // Add active class to the current page
        if (this.activePageId) {
            const activeElement = this.pageList.querySelector(`[data-page-id="${this.activePageId}"]`);
            if (activeElement) {
                activeElement.classList.add('bg-blue-500', 'text-white');
            }
        }
    }

    /**
     * Creates a new, blank page and makes it active.
     * @param {boolean} [save=true] - Whether to save the state immediately.
     */
    createNewPage(save = true) {
        this.saveActivePage(); // Save whatever is currently being worked on first

        const newPageId = `page_${new Date().getTime()}`;
        this.pages[newPageId] = {
            title: '',
            content: '',
            lastModified: new Date().toISOString()
        };
        this.activePageId = newPageId;

        this.renderPageList();
        this.clearEditor();
        this.pageTitle.focus();

        if (save) {
            this.saveState();
        }
        console.log("Created new page:", newPageId);
    }

    /**
     * Switches the active page.
     * @param {string} pageId - The ID of the page to switch to.
     */
    switchActivePage(pageId) {
        if (pageId === this.activePageId) return; // Don't switch if it's the same page

        this.saveActivePage(); // Save the old page
        this.activePageId = pageId;
        this.loadActivePage();
        this.saveState(); // Save the new active page ID
        console.log("Switched to page:", pageId);
    }

    /**
     * @private
     * Handles the focus event on the editor to manage the placeholder.
     */
    handleEditorFocus(event) {
        const editorDiv = event.target;
        editorDiv.classList.remove('empty');
    }

    /**
     * @private
     * Handles the blur event on the editor to manage the placeholder.
     */
    handleEditorBlur() {
        const editorDiv = this.editor;
        if (editorDiv.textContent.trim() === '' && editorDiv.children.length === 0) {
            editorDiv.classList.add('empty');
        } else {
            editorDiv.classList.remove('empty');
        }
    }
}

// Initialize the application once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
    new TypewriterApp();
});
