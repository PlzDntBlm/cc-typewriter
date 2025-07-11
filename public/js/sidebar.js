export default class Sidebar {
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
            pageTitleEl.className = 'flex items-center gap-2 overflow-hidden whitespace-nowrap overflow-hidden text-ellipsis' + (isShrunk ? "" : "grow");
            pageTitleEl.innerHTML = `
                <span class="full-title truncate ${isShrunk ? 'hidden' : ''}">${title}</span>
                <span class="initials font-bold ${isShrunk ? '' : 'hidden'}">${initials}</span>
            `;
            pageTitleEl.addEventListener("click", () => this.app.setActivePage(page.id));

            const deleteBtn = document.createElement('button');
            const baseClasses = "delete-page-btn p-1 rounded-full text-stone-500 hover:text-red-500 dark:hover:text-red-400 transition-opacity flex-shrink-0 group-hover:opacity-100";

            // Conditional classes for visibility based on isShrunk and screen size
            const conditionalClasses = isShrunk
                ? 'hidden opacity-0 sm:hidden'      // When shrunk: hidden on mobile, removed from layout on desktop
                : 'visible opacity-100 sm:opacity-0 sm:group-hover:visible'; // When not shrunk: visible on mobile, hidden on desktop (until hover)

            deleteBtn.className = `${baseClasses} ${conditionalClasses}`;
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
            return li;
        };

        // Render groups and their pages
        groups.forEach(group => {
            const groupContainer = document.createElement('div');
            groupContainer.className = 'pb-1 border-b border-stone-300 dark:border-stone-700';
            const groupHeader = document.createElement('div');
            groupHeader.className = 'group-header flex flex-row h-10 items-center whitespace-nowrap overflow-hidden text-ellipsis';
            if (group.isCollapsed) {
                groupHeader.classList.add('collapsed');
            }
            if (isShrunk) {
                groupHeader.classList.add('justify-center');
            } else {
                groupHeader.classList.add('justify-start')
            }
            const initials = group.title.split(' ').map(w => w[0]).join('').toUpperCase();

            groupHeader.innerHTML = `
                <span>${isShrunk ? initials : group.title}</span>
                ${!isShrunk && group.pageIds.length > 0 ? `<svg class="group-chevron h-full aspect-square transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>` : ''}
            `;
            addDropZoneHandlers(groupHeader, group.id);
            groupHeader.addEventListener('click', (e) => {
                //if (isShrunk) return;
                // Instantly toggle the classes for smooth animation
                groupHeader.classList.toggle('collapsed');
                pageListContainer.classList.toggle('hidden');

                // Then update the state in the background
                this.app.toggleGroupCollapse(group.id);
            });

            groupContainer.appendChild(groupHeader);

            const pageListContainer = document.createElement('div');
            pageListContainer.className = 'flex flex-col gap-2';
            if (group.isCollapsed) {
                pageListContainer.classList.add('hidden');
            }

            group.pageIds.forEach(pageId => {
                const page = pages.find(p => p.id === pageId);
                if (page) {
                    pageListContainer.appendChild(renderPageItem(page));
                }
            });

            groupContainer.appendChild(pageListContainer);
            this.pageListEl.appendChild(groupContainer);
        });

        const ungroupedPages = pages.filter(p => !groups.some(g => g.pageIds.includes(p.id)));
        if (ungroupedPages.length > 0) {
            const ungroupedHeader = document.createElement('div');
            ungroupedHeader.className = 'group-header mt-4';
            ungroupedHeader.textContent = isShrunk ? 'N/A' : 'Not Assigned';
            addDropZoneHandlers(ungroupedHeader, null); // null represents the "Ungrouped" zone
            this.pageListEl.appendChild(ungroupedHeader);
            ungroupedPages.forEach(page => this.pageListEl.appendChild(renderPageItem(page)));
        }
    }
}