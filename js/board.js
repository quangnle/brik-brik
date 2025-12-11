/**
 * BOARD MANAGER
 * Handles board state and line checking/clearing logic
 */
class BoardManager {
    constructor(boardSize) {
        this.boardSize = boardSize;
        this.board = [];
    }

    /**
     * Create an empty board
     */
    createEmptyBoard() {
        this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(0));
    }

    /**
     * Check if a piece can be placed at the given position
     * @param {Array} piece - 2D array representing the piece
     * @param {number} row - Starting row position
     * @param {number} col - Starting column position
     * @returns {boolean} - True if placement is valid
     */
    canPlace(piece, row, col) {
        const pRows = piece.length;
        const pCols = piece[0].length;

        // Check bounds
        if (row < 0 || col < 0 || row + pRows > this.boardSize || col + pCols > this.boardSize) {
            return false;
        }

        // Check overlap
        for (let i = 0; i < pRows; i++) {
            for (let j = 0; j < pCols; j++) {
                if (piece[i][j] === 1 && this.board[row + i][col + j] === 1) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Place a piece on the board
     * @param {Array} pieceMatrix - 2D array representing the piece
     * @param {number} row - Starting row position
     * @param {number} col - Starting column position
     * @returns {boolean} - True if placement was successful
     */
    placePiece(pieceMatrix, row, col) {
        if (!this.canPlace(pieceMatrix, row, col)) {
            return false;
        }

        for (let r = 0; r < pieceMatrix.length; r++) {
            for (let c = 0; c < pieceMatrix[0].length; c++) {
                if (pieceMatrix[r][c] === 1) {
                    this.board[row + r][col + c] = 1; // 1 means filled
                }
            }
        }
        return true;
    }

    /**
     * Check for completed rows and columns
     * @returns {Object} - {rows: [indices], cols: [indices]}
     */
    checkLines() {
        let rows = [];
        let cols = [];

        // Check rows
        for (let r = 0; r < this.boardSize; r++) {
            if (this.board[r].every(val => val === 1)) {
                rows.push(r);
            }
        }

        // Check cols
        for (let c = 0; c < this.boardSize; c++) {
            let isFull = true;
            for (let r = 0; r < this.boardSize; r++) {
                if (this.board[r][c] === 0) {
                    isFull = false;
                    break;
                }
            }
            if (isFull) {
                cols.push(c);
            }
        }

        return { rows, cols };
    }

    /**
     * Clear specified rows and columns
     * @param {Object} lineData - {rows: [indices], cols: [indices]}
     */
    clearLines(lineData) {
        const { rows, cols } = lineData;
        
        // Clear rows
        rows.forEach(r => {
            for (let c = 0; c < this.boardSize; c++) {
                this.board[r][c] = 0;
            }
        });
        
        // Clear cols
        cols.forEach(c => {
            for (let r = 0; r < this.boardSize; r++) {
                this.board[r][c] = 0;
            }
        });
    }

    /**
     * Simulate placing a piece and clearing lines (for piece generation algorithm)
     * @param {Array} board - Board state to modify
     * @param {Array} piece - Piece to place
     * @param {number} r - Row position
     * @param {number} c - Column position
     */
    simulatePlaceAndClear(board, piece, r, c) {
        // 1. Place piece
        for (let i = 0; i < piece.length; i++) {
            for (let j = 0; j < piece[0].length; j++) {
                if (piece[i][j] === 1) {
                    board[r + i][c + j] = 1;
                }
            }
        }
        
        // 2. Check & Clear lines
        let rowsToRemove = [];
        let colsToRemove = [];
        
        // Check rows
        for (let i = 0; i < this.boardSize; i++) {
            if (board[i].every(v => v === 1)) {
                rowsToRemove.push(i);
            }
        }
        
        // Check cols
        for (let j = 0; j < this.boardSize; j++) {
            let colFull = true;
            for (let i = 0; i < this.boardSize; i++) {
                if (board[i][j] === 0) {
                    colFull = false;
                    break;
                }
            }
            if (colFull) {
                colsToRemove.push(j);
            }
        }

        // Clear rows
        rowsToRemove.forEach(ri => {
            for (let j = 0; j < this.boardSize; j++) {
                board[ri][j] = 0;
            }
        });
        
        // Clear cols
        colsToRemove.forEach(ci => {
            for (let i = 0; i < this.boardSize; i++) {
                board[i][ci] = 0;
            }
        });
    }

    /**
     * Find a valid position for a piece on the board
     * @param {Array} board - Board state to check
     * @param {Array} piece - Piece to find position for
     * @returns {Object|null} - {r, c} if found, null otherwise
     */
    findValidPosition(board, piece) {
        for (let r = 0; r <= this.boardSize - piece.length; r++) {
            for (let c = 0; c <= this.boardSize - piece[0].length; c++) {
                if (this.canPlaceOnBoard(board, piece, r, c)) {
                    return { r, c };
                }
            }
        }
        return null;
    }

    /**
     * Check if piece can be placed on a specific board state
     * @param {Array} board - Board state to check
     * @param {Array} piece - Piece to check
     * @param {number} row - Row position
     * @param {number} col - Column position
     * @returns {boolean}
     */
    canPlaceOnBoard(board, piece, row, col) {
        const pRows = piece.length;
        const pCols = piece[0].length;

        if (row < 0 || col < 0 || row + pRows > this.boardSize || col + pCols > this.boardSize) {
            return false;
        }

        for (let i = 0; i < pRows; i++) {
            for (let j = 0; j < pCols; j++) {
                if (piece[i][j] === 1 && board[row + i][col + j] === 1) {
                    return false;
                }
            }
        }
        return true;
    }
}

