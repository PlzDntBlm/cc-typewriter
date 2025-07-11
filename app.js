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
        const target = event.target.closest('.page-link');
        if (target) {
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
        this.newPageBtn = document.getElementById("new-page-btn");
        this.newPageBtn.addEventListener("click", () => this.app.createNewPage());

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
            if (newWidth < 180) newWidth = 180;
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
            this.sidebarEl.style.width = '';
        } else {
            this.toggleBtn.innerHTML = this.collapseIcon;
            this.resizerEl.classList.remove('hidden');
            const savedWidth = localStorage.getItem('sidebarWidth');
            this.sidebarEl.style.width = savedWidth || '256px';
        }

        if (this.app && this.app.pages) {
            this.render(this.app.pages, this.app.activePageId);
        }
    }

    loadState() {
        const isShrunk = localStorage.getItem('sidebarShrunk') === 'true';
        if (isShrunk) {
            this.sidebarEl.classList.add('shrunk');
        }
        this.updateSidebarState();
    }

    render(pages, activePageId) {
        const isShrunk = this.sidebarEl.classList.contains('shrunk');
        this.pageListEl.innerHTML = "";
        pages.forEach((page) => {
            const li = document.createElement("li");
            li.className = "group cursor-pointer p-2 rounded hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors flex items-center justify-between";
            if (page.id === activePageId) {
                li.classList.add("bg-stone-300", "dark:bg-stone-700", "font-bold");
            }

            const title = page.title || "Untitled";
            const initials = title.split(' ').map(w => w[0]).join('').toUpperCase();

            const pageTitleEl = document.createElement('div');
            pageTitleEl.className = 'flex items-center gap-2 overflow-hidden';
            pageTitleEl.innerHTML = `
                <span class="full-title truncate ${isShrunk ? 'hidden' : ''}">${title}</span>
                <span class="initials font-bold ${isShrunk ? '' : 'hidden'}">${initials}</span>
            `;
            pageTitleEl.addEventListener("click", () => this.app.setActivePage(page.id));

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-page-btn p-1 rounded-full text-stone-500 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0';
            deleteBtn.title = `Delete "${title}"`;

            const trashIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`;
            deleteBtn.innerHTML = trashIcon;

            let pressTimer = null;
            let animationFrame = null;
            const DURATION = 1500;

            const cancelDeletion = () => {
                cancelAnimationFrame(animationFrame);
                clearTimeout(pressTimer);
                deleteBtn.innerHTML = trashIcon;
                window.removeEventListener('mouseup', cancelDeletion);
            };

            deleteBtn.addEventListener('mousedown', (e) => {
                e.stopPropagation();

                // --- FIX START ---
                // The animation logic is corrected here.
                const progressCircle = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                progressCircle.setAttribute("class", "delete-progress-ring");
                progressCircle.setAttribute("viewBox", "0 0 36 36");
                // Set the initial state directly in the SVG markup
                progressCircle.innerHTML = `
                    <path class="delete-progress-ring-circle" stroke-dasharray="20, 100" d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"/>
                `;
                deleteBtn.innerHTML = '';
                deleteBtn.appendChild(progressCircle);

                const circle = progressCircle.querySelector('.delete-progress-ring-circle');
                const startTime = Date.now();

                const animate = () => {
                    const elapsedTime = Date.now() - startTime;
                    let progress = elapsedTime / DURATION;
                    if (progress > 1) progress = 1;

                    // Animate the fill amount from 20% to 100%
                    const fillAmount = 20 + (80 * progress);
                    circle.style.strokeDasharray = `${fillAmount}, 100`;

                    // Animate color from grey to red
                    const red = 150 + (105 * progress);
                    const green = 150 - (100 * progress);
                    const blue = 150 - (100 * progress);
                    circle.style.stroke = `rgb(${red}, ${green}, ${blue})`;

                    if (progress < 1) {
                        animationFrame = requestAnimationFrame(animate);
                    }
                };
                animationFrame = requestAnimationFrame(animate);

                pressTimer = setTimeout(() => {
                    cancelAnimationFrame(animationFrame);
                    this.app.deletePage(page.id);
                }, DURATION);

                window.addEventListener('mouseup', cancelDeletion, {once: true});
                // --- FIX END ---
            });

            li.appendChild(pageTitleEl);
            li.appendChild(deleteBtn);
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

    async deletePage(pageIdToDelete) {
        const pageToDelete = this.pages.find(p => p.id === pageIdToDelete);
        if (!pageToDelete) return;

        this.pages = this.pages.filter(p => p.id !== pageIdToDelete);

        if (this.activePageId === pageIdToDelete) {
            this.activePageId = this.pages[0]?.id || null;
        }

        if (this.pages.length === 0) {
            await this.createNewPage("My First Note", "This is your first note. Welcome!");
        } else {
            await this.storage.save({pages: this.pages, activePageId: this.activePageId});
            this.render();
        }
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const app = new App();
    await app.init();
});