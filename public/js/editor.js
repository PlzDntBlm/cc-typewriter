export default class Editor {
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