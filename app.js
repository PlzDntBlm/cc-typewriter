// --- NEW STORAGE CLASS ---
// This class now communicates with the server API instead of localStorage.
class Storage {
    async get() {
        try {
            const response = await fetch('/api/data');
            if (!response.ok) {
                throw new Error('Failed to fetch data from server.');
            }
            return await response.json();
        } catch (error) {
            console.error(error);
            // Return a default structure if the server is unreachable
            return {pages: [], activePageId: null};
        }
    }

    async save(data) {
        try {
            await fetch('/api/data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
        } catch (error) {
            console.error('Failed to save data to server:', error);
        }
    }
}

class Editor {
    constructor(app) {
        this.app = app;
        this.editorEl = document.getElementById("editor");
        this.titleEl = document.getElementById("page-title");

        this.titleEl.addEventListener("input", () => this.app.save());
        this.editorEl.addEventListener("input", () => this.onEditorInput());
        this.editorEl.addEventListener("click", (e) => this.onEditorClick(e));
    }

    onEditorInput() {
        this._checkForLinks();
        this.app.save();
    }

    onEditorClick(event) {
        const target = event.target;
        if (target.classList.contains("page-link")) {
            const pageId = target.dataset.pageId;
            if (pageId) {
                this.app.setActivePage(pageId);
            }
        }
    }

    _checkForLinks() {
        const LINK_REGEX = /\[\[(.*?)\]\]/g;
        const selection = window.getSelection();
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        if (!range) return;

        const currentNode = range.startContainer;

        if (currentNode.nodeType === Node.TEXT_NODE) {
            const parent = currentNode.parentNode;
            let match;
            while ((match = LINK_REGEX.exec(currentNode.textContent)) !== null) {
                const [fullMatch, pageTitle] = match;
                const linkedPage = this.app.pages.find(
                    (p) => p.title.toLowerCase() === pageTitle.toLowerCase()
                );
                if (linkedPage && !parent.classList.contains("page-link")) {
                    const linkNode = this._createLinkNode(linkedPage);
                    const matchRange = document.createRange();
                    matchRange.setStart(currentNode, match.index);
                    matchRange.setEnd(currentNode, match.index + fullMatch.length);
                    matchRange.deleteContents();
                    matchRange.insertNode(linkNode);
                    range.setStartAfter(linkNode);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    return;
                }
            }
        }
    }

    _createLinkNode(page) {
        const span = document.createElement("span");
        span.textContent = page.title;
        span.className = "page-link";
        span.dataset.pageId = page.id;
        span.contentEditable = "false";
        return span;
    }

    setContent(page) {
        this.titleEl.value = page.title;
        this.editorEl.innerHTML = page.content;
        this._checkForLinksOnLoad();
    }

    _checkForLinksOnLoad() {
        const textNodes = this._getTextNodes(this.editorEl);
        textNodes.forEach(node => {
            const LINK_REGEX = /\[\[(.*?)\]\]/g;
            let match;
            while ((match = LINK_REGEX.exec(node.textContent)) !== null) {
                const [fullMatch, pageTitle] = match;
                const linkedPage = this.app.pages.find(
                    (p) => p.title.toLowerCase() === pageTitle.toLowerCase()
                );
                if (linkedPage) {
                    const linkNode = this._createLinkNode(linkedPage);
                    const range = document.createRange();
                    range.setStart(node, match.index);
                    range.setEnd(node, match.index + fullMatch.length);
                    range.deleteContents();
                    range.insertNode(linkNode);
                    this._checkForLinksOnLoad();
                    return;
                }
            }
        });
    }

    _getTextNodes(element) {
        let textNodes = [];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            (node) => {
                return node.parentElement.classList.contains('page-link')
                    ? NodeFilter.FILTER_REJECT
                    : NodeFilter.FILTER_ACCEPT;
            },
            false
        );
        let node;
        while ((node = walker.nextNode())) {
            textNodes.push(node);
        }
        return textNodes;
    }

    getContent() {
        return {
            title: this.titleEl.value,
            content: this.editorEl.innerHTML,
        };
    }
}

class Sidebar {
    constructor(app) {
        this.app = app;
        this.sidebarEl = document.getElementById("sidebar");
        this.pageListEl = document.getElementById("page-list");
        this.newPageBtn = document.getElementById("new-page-btn");

        this.newPageBtn.addEventListener("click", () => this.app.createNewPage());
    }

    render(pages, activePageId) {
        this.pageListEl.innerHTML = "";
        pages.forEach((page) => {
            const li = document.createElement("li");
            li.textContent = page.title || "Untitled";
            li.dataset.pageId = page.id;
            li.className =
                "cursor-pointer p-2 rounded hover:bg-stone-700 transition-colors";
            if (page.id === activePageId) {
                li.classList.add("bg-stone-600", "font-bold");
            }
            li.addEventListener("click", () => this.app.setActivePage(page.id));
            this.pageListEl.appendChild(li);
        });
    }
}

class App {
    constructor() {
        this.storage = new Storage();
        this.pages = [];
        this.activePageId = null;
        this.editor = new Editor(this);
        this.sidebar = new Sidebar(this);
    }

    // Initialize the app by fetching data from the server
    async init() {
        const data = await this.storage.get();
        this.pages = data.pages;
        this.activePageId = data.activePageId;

        if (this.pages.length === 0) {
            await this.createNewPage("My First Note", "This is your first note. Welcome!");
        } else {
            if (!this.activePageId || !this.pages.find(p => p.id === this.activePageId)) {
                this.activePageId = this.pages[0]?.id || null;
            }
            this.render();
        }
    }

    async save() {
        const activePage = this.getActivePage();
        if (activePage) {
            const {title, content} = this.editor.getContent();
            activePage.title = title;
            activePage.content = content;
        }
        await this.storage.save({
            pages: this.pages,
            activePageId: this.activePageId,
        });
        this.sidebar.render(this.pages, this.activePageId);
    }

    render() {
        const activePage = this.getActivePage();
        if (activePage) {
            this.editor.setContent(activePage);
        }
        this.sidebar.render(this.pages, this.activePageId);
    }

    getActivePage() {
        return this.pages.find((page) => page.id === this.activePageId);
    }

    setActivePage(id) {
        this.activePageId = id;
        this.render();
        // Save the active page change
        this.storage.save({pages: this.pages, activePageId: this.activePageId});
    }

    async createNewPage(title = "Untitled", content = "Start typing...") {
        const newPage = {
            id: `page-${Date.now()}`,
            title,
            content,
        };
        this.pages.push(newPage);
        this.activePageId = newPage.id;

        // Save the new state to the server
        await this.storage.save({
            pages: this.pages,
            activePageId: this.activePageId
        });

        // Render the UI
        this.render();
    }
}

// --- UPDATED APP INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
    const app = new App();
    await app.init();
});