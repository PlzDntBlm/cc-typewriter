class Storage {
    async get() {
        try {
            const response = await fetch('/api/data');
            if (!response.ok) throw new Error('Failed to fetch data from server.');
            const data = await response.json();
            if (!data.groups) {
                data.groups = [];
            }
            return data;
        } catch (error) {
            console.error(error);
            return {pages: [], groups: [], activePageId: null};
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
        this.newGroupBtn = document.getElementById("new-group-btn");

        this.newPageBtn.addEventListener("click", () => this.app.createNewPage());
        this.newGroupBtn.addEventListener("click", () => this.app.createGroup());

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
            this.render(this.app.pages, this.app.groups, this.app.activePageId);
        }
    }

    loadState() {
        const isShrunk = localStorage.getItem('sidebarShrunk') === 'true';
        if (isShrunk) {
            this.sidebarEl.classList.add('shrunk');
        }
        this.updateSidebarState();
    }

    render(pages, groups, activePageId) {
        const isShrunk = this.sidebarEl.classList.contains('shrunk');
        this.pageListEl.innerHTML = "";

        const addDropZoneHandlers = (element, groupId) => {
            element.addEventListener('dragover', (e) => {
                e.preventDefault();
                element.classList.add('drag-over');
            });
            element.addEventListener('dragleave', () => {
                element.classList.remove('drag-over');
            });
            element.addEventListener('drop', (e) => {
                e.preventDefault();
                element.classList.remove('drag-over');
                const pageId = e.dataTransfer.getData('text/plain');
                this.app.movePageToGroup(pageId, groupId);
            });
        };

        const renderPageItem = (page) => {
            const li = document.createElement("li");
            li.setAttribute('draggable', 'true');
            li.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', page.id);
                e.dataTransfer.effectAllowed = 'move';
            });
            li.className = "group cursor-pointer p-2 rounded hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors flex items-center " + (isShrunk ? "justify-center" : "justify-between");
            if (page.id === activePageId) {
                li.classList.add("bg-stone-300", "dark:bg-stone-700", "font-bold");
            }

            const title = page.title || "Untitled";
            const initials = title.split(' ').map(w => w[0]).join('').toUpperCase();

            const pageTitleEl = document.createElement('div');
            pageTitleEl.className = 'flex items-center gap-2 overflow-hidden grow';
            pageTitleEl.innerHTML = `
                <span class="full-title truncate ${isShrunk ? 'hidden' : ''}">${title}</span>
                <span class="initials font-bold ${isShrunk ? '' : 'hidden'}">${initials}</span>
            `;
            pageTitleEl.addEventListener("click", () => this.app.setActivePage(page.id));

            const deleteBtn = document.createElement('button');
            deleteBtn.className = "delete-page-btn p-1 rounded-full text-stone-500 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 " + (isShrunk ? 'hidden' : '');
            deleteBtn.title = `Delete "${title}"`;

            const trashIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`;
            deleteBtn.innerHTML = trashIcon;

            let pressTimer = null;
            let animationFrame = null;
            const HOLD_DURATION = 1500;
            const HINT_THRESHOLD = 200;
            let pressStartTime = 0;

            const createProgressCircle = () => {
                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svg.setAttribute("class", "delete-progress-ring");
                svg.setAttribute("viewBox", "0 0 36 36");
                svg.innerHTML = `<path class="delete-progress-ring-circle" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>`;
                return svg;
            };

            const onMouseUp = () => {
                const pressDuration = Date.now() - pressStartTime;
                clearTimeout(pressTimer);
                cancelAnimationFrame(animationFrame);

                if (pressDuration < HINT_THRESHOLD) {
                    const circleContainer = createProgressCircle();
                    const circle = circleContainer.querySelector('.delete-progress-ring-circle');
                    deleteBtn.innerHTML = '';
                    deleteBtn.appendChild(circleContainer);

                    requestAnimationFrame(() => {
                        circle.classList.add('hint');
                    });

                    setTimeout(() => {
                        deleteBtn.innerHTML = trashIcon;
                    }, 400);
                } else {
                    deleteBtn.innerHTML = trashIcon;
                }

                window.removeEventListener('mouseup', onMouseUp);
            };

            deleteBtn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                pressStartTime = Date.now();

                pressTimer = setTimeout(() => {
                    const circleContainer = createProgressCircle();
                    const circle = circleContainer.querySelector('.delete-progress-ring-circle');
                    deleteBtn.innerHTML = '';
                    deleteBtn.appendChild(circleContainer);

                    const animStartTime = Date.now();

                    const animate = () => {
                        const elapsedTime = Date.now() - animStartTime;
                        let progress = elapsedTime / (HOLD_DURATION - HINT_THRESHOLD);
                        if (progress > 1) progress = 1;

                        const fillAmount = progress * 100;
                        circle.style.strokeDasharray = `${fillAmount}, 100`;

                        const red = 150 + (105 * progress);
                        const green = 150 - (100 * progress);
                        const blue = 150 - (100 * progress);
                        circle.style.stroke = `rgb(${red}, ${green}, ${blue})`;

                        if (progress < 1) {
                            animationFrame = requestAnimationFrame(animate);
                        } else {
                            this.app.deletePage(page.id);
                        }
                    };
                    animationFrame = requestAnimationFrame(animate);
                }, HINT_THRESHOLD);

                window.addEventListener('mouseup', onMouseUp, {once: true});
            });

            li.appendChild(pageTitleEl);
            li.appendChild(deleteBtn);
            this.pageListEl.appendChild(li);
        };

        // Render groups and their pages
        groups.forEach(group => {
            const groupHeader = document.createElement('div');
            groupHeader.className = 'group-header';
            groupHeader.textContent = group.title;
            addDropZoneHandlers(groupHeader, group.id);
            this.pageListEl.appendChild(groupHeader);

            group.pageIds.forEach(pageId => {
                const page = pages.find(p => p.id === pageId);
                if (page) renderPageItem(page);
            });
        });

        const ungroupedPages = pages.filter(p => !groups.some(g => g.pageIds.includes(p.id)));
        if (ungroupedPages.length > 0) {
            const ungroupedHeader = document.createElement('div');
            ungroupedHeader.className = 'group-header mt-4';
            ungroupedHeader.textContent = 'Ungrouped';
            addDropZoneHandlers(ungroupedHeader, null); // null represents the "Ungrouped" zone
            this.pageListEl.appendChild(ungroupedHeader);
            ungroupedPages.forEach(renderPageItem);
        }
    }
}

class App {
    constructor() {
        this.storage = new Storage();
        this.pages = [];
        this.groups = [];
        this.activePageId = null;
        this.editor = new Editor(this);
        this.sidebar = new Sidebar(this);
    }

    async init() {
        const data = await this.storage.get();
        this.pages = data.pages;
        this.groups = data.groups || [];
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
        await this.storage.save({pages: this.pages, groups: this.groups, activePageId: this.activePageId});
        this.sidebar.render(this.pages, this.groups, this.activePageId);
    }

    render() {
        const activePage = this.getActivePage();
        if (activePage) this.editor.setContent(activePage);
        this.sidebar.render(this.pages, this.groups, this.activePageId);
    }

    getActivePage() {
        return this.pages.find((page) => page.id === this.activePageId);
    }

    setActivePage(id) {
        this.activePageId = id;
        this.render();
    }

    async createNewPage(title = "Untitled", content = "Start typing...") {
        const newPage = {id: `page-${Date.now()}`, title, content};
        this.pages.push(newPage);
        this.activePageId = newPage.id;
        await this.storage.save({pages: this.pages, groups: this.groups, activePageId: this.activePageId});
        this.render();
    }

    async createGroup() {
        const title = window.prompt("Enter a name for the new group:", "New Group");
        if (!title) return;

        const newGroup = {
            id: `group-${Date.now()}`,
            title,
            pageIds: []
        };

        this.groups.push(newGroup);
        await this.storage.save({pages: this.pages, groups: this.groups, activePageId: this.activePageId});
        this.render();
    }

    async deletePage(pageIdToDelete) {
        const pageToDelete = this.pages.find(p => p.id === pageIdToDelete);
        if (!pageToDelete) return;

        this.pages = this.pages.filter(p => p.id !== pageIdToDelete);

        // Also remove the page from any group it might be in
        this.groups.forEach(group => {
            group.pageIds = group.pageIds.filter(id => id !== pageIdToDelete);
        });

        if (this.activePageId === pageIdToDelete) {
            this.activePageId = this.pages[0]?.id || null;
        }

        if (this.pages.length === 0) {
            await this.createNewPage("My First Note", "This is your first note. Welcome!");
        } else {
            await this.storage.save({pages: this.pages, groups: this.groups, activePageId: this.activePageId});
            this.render();
        }
    }

    async movePageToGroup(pageId, targetGroupId) {
        // Remove page from any existing group
        this.groups.forEach(group => {
            group.pageIds = group.pageIds.filter(id => id !== pageId);
        });

        // Add page to the new group (if a group was targeted)
        if (targetGroupId) {
            const targetGroup = this.groups.find(g => g.id === targetGroupId);
            if (targetGroup) {
                targetGroup.pageIds.push(pageId);
            }
        }

        await this.storage.save({pages: this.pages, groups: this.groups, activePageId: this.activePageId});
        this.render();
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const app = new App();
    await app.init();
});