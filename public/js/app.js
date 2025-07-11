import Storage from './storage.js';
import Editor from './editor.js';
import Sidebar from './sidebar.js';

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

    async toggleGroupCollapse(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (group) {
            group.isCollapsed = !group.isCollapsed;
            await this.storage.save({pages: this.pages, groups: this.groups, activePageId: this.activePageId});
        }
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const app = new App();
    await app.init();
});