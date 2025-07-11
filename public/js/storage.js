export default class Storage {
    async get() {
        try {
            const response = await fetch('/api/data');
            if (!response.ok) throw new Error('Failed to fetch data from server.');
            const data = await response.json();
            if (!data.groups) {
                data.groups = [];
            }
            data.groups.forEach(g => {
                if (g.isCollapsed === undefined) {
                    g.isCollapsed = false;
                }
            });
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