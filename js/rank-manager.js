/**
 * RANK MANAGER
 * Handles top rank storage and management
 * Now uses server API instead of localStorage
 */
class RankManager {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.topRank = null;
    }

    /**
     * Load top rank from server
     * @returns {Promise<Object|null>} - {name: string, score: number, date: string} or null
     */
    async loadTopRank() {
        try {
            const ranks = await this.apiClient.getTopRank();
            this.topRanks = Array.isArray(ranks) ? ranks : (ranks ? [ranks] : []);
            this.topRank = this.topRanks.length > 0 ? this.topRanks[0] : null;
            return this.topRanks;
        } catch (e) {
            console.error('Error loading top rank:', e);
            return [];
        }
    }

    /**
     * Save top rank to server
     * @param {string} name - Player name
     * @param {number} score - Player score
     * @returns {Promise<boolean>} - True if saved successfully
     */
    async saveTopRank(name, score) {
        try {
            const result = await this.apiClient.saveTopRank(name, score);
            // API now returns {rank, ranks}
            this.topRank = result.rank;
            this.topRanks = result.ranks;
            return true;
        } catch (e) {
            console.error('Error saving top rank:', e);
            return false;
        }
    }

    /**
     * Check if score is a new record (qualifies for top 10)
     * @param {number} score - Score to check
     * @returns {Promise<boolean>} - True if score qualifies for top 10
     */
    async isNewRecord(score) {
        if (!this.topRanks) {
            await this.loadTopRank();
        }
        if (this.topRanks.length < 10) return true;
        return score > this.topRanks[this.topRanks.length - 1].score;
    }

    /**
     * Get current top ranks
     * @returns {Promise<Array>} - Top ranks array
     */
    async getTopRanks() {
        if (!this.topRanks) {
            await this.loadTopRank();
        }
        return this.topRanks;
    }

    /**
     * Get the absolute #1 rank
     * @returns {Promise<Object|null>} - Top rank data or null
     */
    async getTopRank() {
        if (!this.topRanks) {
            await this.loadTopRank();
        }
        return this.topRank;
    }
}
