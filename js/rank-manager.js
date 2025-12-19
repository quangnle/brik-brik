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
            const rank = await this.apiClient.getTopRank();
            this.topRank = rank;
            return rank;
        } catch (e) {
            console.error('Error loading top rank:', e);
            return null;
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
            const rankData = await this.apiClient.saveTopRank(name, score);
            this.topRank = rankData;
            return true;
        } catch (e) {
            console.error('Error saving top rank:', e);
            return false;
        }
    }

    /**
     * Check if score is a new record
     * @param {number} score - Score to check
     * @returns {Promise<boolean>} - True if score is higher than current record
     */
    async isNewRecord(score) {
        if (!this.topRank) {
            await this.loadTopRank();
        }
        if (!this.topRank) return true;
        return score > this.topRank.score;
    }

    /**
     * Get current top rank
     * @returns {Promise<Object|null>} - Top rank data or null
     */
    async getTopRank() {
        if (!this.topRank) {
            await this.loadTopRank();
        }
        return this.topRank;
    }
}
