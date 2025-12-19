/**
 * API CLIENT
 * Handles all communication with the server
 */

class APIClient {
    constructor(baseURL = '') {
        this.baseURL = baseURL;
        this.sessionId = null;
    }

    /**
     * Initialize a new game
     * @returns {Promise<Object>} - {sessionId, board, score, pieces}
     */
    async initGame() {
        try {
            const response = await fetch(`${this.baseURL}/api/game/init`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.sessionId || null
                })
            });
            
            const data = await response.json();
            if (data.success) {
                this.sessionId = data.sessionId;
                return data;
            } else {
                throw new Error(data.error || 'Failed to initialize game');
            }
        } catch (error) {
            console.error('Error initializing game:', error);
            throw error;
        }
    }

    /**
     * Place a piece on the board
     * @param {Object} piece - Piece object with matrix
     * @param {number} x - Row position
     * @param {number} y - Column position
     * @returns {Promise<Object>} - Updated game state
     */
    async placePiece(piece, x, y) {
        if (!this.sessionId) {
            throw new Error('No active game session');
        }

        try {
            const response = await fetch(`${this.baseURL}/api/game/place`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    piece: piece,
                    x: x,
                    y: y
                })
            });
            
            const data = await response.json();
            
            // Check if response was successful
            if (!response.ok || !data.success) {
                const errorMsg = data.error || `Server error: ${response.status} ${response.statusText}`;
                throw new Error(errorMsg);
            }
            
            return data;
        } catch (error) {
            // Re-throw if it's already our Error object
            if (error instanceof Error && error.message) {
                throw error;
            }
            // Otherwise wrap it
            console.error('Error placing piece:', error);
            throw new Error(error.message || 'Failed to place piece');
        }
    }

    /**
     * Request new pieces (only if all current pieces are used)
     * @returns {Promise<Object>} - New pieces array
     */
    async requestNewPieces() {
        if (!this.sessionId) {
            throw new Error('No active game session');
        }

        try {
            const response = await fetch(`${this.baseURL}/api/game/requestNewPieces`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.sessionId
                })
            });
            
            const data = await response.json();
            
            // Check if response was successful
            if (!response.ok || !data.success) {
                const errorMsg = data.error || `Server error: ${response.status} ${response.statusText}`;
                throw new Error(errorMsg);
            }
            
            return data;
        } catch (error) {
            // Re-throw if it's already our Error object
            if (error instanceof Error && error.message) {
                throw error;
            }
            // Otherwise wrap it
            console.error('Error requesting new pieces:', error);
            throw new Error(error.message || 'Failed to request new pieces');
        }
    }

    /**
     * Get current game state
     * @returns {Promise<Object>} - Current game state
     */
    async getGameState() {
        if (!this.sessionId) {
            throw new Error('No active game session');
        }

        try {
            const response = await fetch(`${this.baseURL}/api/game/state/${this.sessionId}`);
            const data = await response.json();
            if (data.success) {
                return data;
            } else {
                throw new Error(data.error || 'Failed to get game state');
            }
        } catch (error) {
            console.error('Error getting game state:', error);
            throw error;
        }
    }

    /**
     * Get top rank
     * @returns {Promise<Object|null>} - Top rank data or null
     */
    async getTopRank() {
        try {
            const response = await fetch(`${this.baseURL}/api/rank`);
            const data = await response.json();
            if (data.success) {
                return data.rank;
            } else {
                throw new Error(data.error || 'Failed to get top rank');
            }
        } catch (error) {
            console.error('Error getting top rank:', error);
            return null;
        }
    }

    /**
     * Save top rank
     * @param {string} name - Player name
     * @param {number} score - Player score
     * @returns {Promise<Object>} - Saved rank data
     */
    async saveTopRank(name, score) {
        try {
            const response = await fetch(`${this.baseURL}/api/rank`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    score: score
                })
            });
            
            const data = await response.json();
            if (data.success) {
                return data.rank;
            } else {
                throw new Error(data.error || 'Failed to save top rank');
            }
        } catch (error) {
            console.error('Error saving top rank:', error);
            throw error;
        }
    }
}
