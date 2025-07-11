class Storage {
    async get() {
        try {
            const response = await fetch('/api/data');
            if (!response.ok) throw new Error('Failed to fetch data from server.');
            return await response.json();
        } catch (error) {
            console.error(error);
            return {pages: [], activePageId: null};
        }
    }

    async save(data) {
        try {
            await fetch('/api/data', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
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
            if (pageId) this.app.setActivePage(pageId);
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
                const linkedPage = this.app.pages.find((p) => p.title.toLowerCase() === pageTitle.toLowerCase());
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
                const linkedPage = this.app.pages.find((p) => p.title.toLowerCase() === pageTitle.toLowerCase());
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
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, (node) => {
            return node.parentElement.classList.contains('page-link') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        }, false);
        let node;
        while ((node = walker.nextNode())) textNodes.push(node);
        return textNodes;
    }

    getContent() {
        return {title: this.titleEl.value, content: this.editorEl.innerHTML};
    }
}

class Sidebar {
    constructor(app) {
        this.app = app;
        this.sidebarEl = document.getElementById("sidebar");
        this.pageListEl = document.getElementById("page-list");
        this.resizerEl = document.getElementById("resizer");
        this.toggleBtn = document.getElementById("toggle-sidebar-btn");

        this.isResizing = false;

        this.collapseIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>`;
        this.expandIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>`;

        this.initResize();
        this.initToggle();
        this.loadState();
    }

    initResize() {
        const handleMouseMove = (e) => {
            if (!this.isResizing) return;
            let newWidth = e.clientX;
            if (newWidth < 120) newWidth = 120;
            if (newWidth > 600) newWidth = 600;
            this.sidebarEl.style.width = `${newWidth}px`;
        };

        const handleMouseUp = () => {
            if (!this.isResizing) return;
            this.isResizing = false;
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            localStorage.setItem('sidebarWidth', this.sidebarEl.style.width);
        };

        this.resizerEl.addEventListener("mousedown", (e) => {
            e.preventDefault();
            this.isResizing = true;
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
        });
    }

    initToggle() {
        this.toggleBtn.addEventListener('click', () => {
            this.sidebarEl.classList.toggle('shrunk');
            this.updateSidebarState();
        });
    }

    updateSidebarState() {
        const isShrunk = this.sidebarEl.classList.contains('shrunk');
        localStorage.setItem('sidebarShrunk', isShrunk);

        if (isShrunk) {
            this.toggleBtn.innerHTML = this.expandIcon;
            this.resizerEl.classList.add('hidden');
        } else {
            this.toggleBtn.innerHTML = this.collapseIcon;
            this.resizerEl.classList.remove('hidden');
        }

        // --- FIX ---
        // The sidebar now re-renders its own list instead of calling the main app's render method.
        // This check ensures we don't try to render before the app's pages have been loaded.
        if (this.app && this.app.pages) {
            this.render(this.app.pages, this.app.activePageId);
        }
    }

    loadState() {
        const isShrunk = localStorage.getItem('sidebarShrunk') === 'true';
        if (isShrunk) {
            this.sidebarEl.classList.add('shrunk');
        } else {
            const savedWidth = localStorage.getItem('sidebarWidth');
            this.sidebarEl.style.width = savedWidth || '256px';
        }
        this.updateSidebarState();
    }

    render(pages, activePageId) {
        const isShrunk = this.sidebarEl.classList.contains('shrunk');
        this.pageListEl.innerHTML = "";
        pages.forEach((page) => {
            const li = document.createElement("li");
            const title = page.title || "Untitled";
            const initials = title.split(' ').map(w => w[0]).join('').toUpperCase();

            li.className = "cursor-pointer p-2 rounded hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors flex items-center gap-2 group-[.shrunk]:justify-center";
            if (page.id === activePageId) {
                li.classList.add("bg-stone-300", "dark:bg-stone-700", "font-bold");
            }

            li.innerHTML = `
                <span class="full-title truncate ${isShrunk ? 'hidden' : ''}">${title}</span>
                <span class="initials font-bold ${isShrunk ? '' : 'hidden'}">${initials}</span>
            `;

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
        // The sidebar is now fully initialized before the app continues.
        this.sidebar = new Sidebar(this);
    }

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
        await this.storage.save({pages: this.pages, activePageId: this.activePageId});
        this.render();
    }

    render() {
        const activePage = this.getActivePage();
        if (activePage) this.editor.setContent(activePage);
        this.sidebar.render(this.pages, this.activePageId);
    }

    getActivePage() {
        return this.pages.find((page) => page.id === this.activePageId);
    }

    setActivePage(id) {
        this.activePageId = id;
        this.storage.save({pages: this.pages, activePageId: this.activePageId});
        this.render();
    }

    async createNewPage(title = "Untitled", content = "Start typing...") {
        const newPage = {id: `page-${Date.now()}`, title, content};
        this.pages.push(newPage);
        this.activePageId = newPage.id;
        await this.storage.save({pages: this.pages, activePageId: this.activePageId});
        this.render();
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const app = new App();
    await app.init();
});