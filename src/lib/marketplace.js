export class MarketplaceManager {
    constructor() {
        this.eventStats = JSON.parse(localStorage.getItem('event_stats') || '{}');
    }

    getEventData(event) {
        let data = {};
        const tags = event.tags || [];
        const getTag = (k) => (tags.find(t => t[0] === k) || [])[1];
        
        // Priority 1: NIP-99 Tags
        data.id = getTag('d');
        data.title = getTag('title') || getTag('name') || getTag('summary');
        data.description = getTag('description') || getTag('summary') || event.content;
        data.price = parseInt(getTag('price') || 0);
        data.min = parseInt(getTag('min') || 1);
        data.max = parseInt(getTag('max') || 100);
        data.image = getTag('image');
        
        // Priority 2: Legacy JSON content
        try {
            if (event.content.startsWith('{')) {
                const parsed = JSON.parse(event.content);
                if (parsed.type === "EVENT_MARKETPLACE") {
                    data.id = data.id || parsed.id;
                    data.title = data.title || parsed.title;
                    data.description = data.description || parsed.description;
                    data.price = data.price || parsed.price;
                    data.min = data.min || parsed.min;
                    data.max = data.max || parsed.max;
                }
            }
        } catch (e) {}

        return data;
    }

    getStats(eventId) {
        return this.eventStats[eventId] || { count: 0, reserved: false, participants: [] };
    }

    saveStats() {
        localStorage.setItem('event_stats', JSON.stringify(this.eventStats));
    }

    reservePlacement(eventId, pubkey) {
        if (!this.eventStats[eventId]) {
            this.eventStats[eventId] = { count: 0, reserved: false, participants: [] };
        }
        
        const stats = this.eventStats[eventId];
        if (!stats.participants.includes(pubkey)) {
            stats.participants.push(pubkey);
            stats.count++;
            stats.reserved = true;
            this.saveStats();
            return true;
        }
        return false;
    }

    calculateProgress(stats, max) {
        return Math.min(100, (stats.count / max) * 100);
    }

    formatFiat(priceSats) {
        // Mock conversion (100k sats approx 60 eur)
        return (priceSats * 0.0006).toFixed(2);
    }
}

export const marketplace = new MarketplaceManager();
