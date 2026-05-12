/**
 * SERVER
 * Node.js/Express server for Brik Brik game
 * Manages game state and handles client requests
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Game constants (shared with client)
const BOARD_SIZE = 8;
const PIECES_PER_ROUND = 3;
const MAX_GENERATION_ATTEMPTS = 50;
const BASE_POINTS_PER_BLOCK = 1;
const LINE_CLEAR_BASE_POINTS = 10;
const LINE_CLEAR_MULTIPLIER = 2;

const RAW_SHAPES = {
    P1: [[1,1,1,1]],
    P2: [[1,1,1]],
    P3: [[1,1]],
    P4: [[1]],
    P5: [[1,0,0], [1,0,0], [1,1,1]],
    P6: [[1,0], [1,1]],
    P7: [[1,0], [1,0], [1,1]],
    P8: [[0,1,0], [1,1,1]],
    P9: [[1,1,0], [0,1,1]],
    P10: [[1,1,1], [1,1,1], [1,1,1]],
    P11: [[1,1], [1,1]]
};

const COLORS = [
    'bg-cyan-500', 'bg-blue-500', 'bg-orange-500', 'bg-yellow-500',
    'bg-green-500', 'bg-purple-500', 'bg-red-500', 'bg-pink-500'
];

// In-memory game sessions (in production, use Redis or database)
const gameSessions = new Map();

// Helper: Compare two matrices for equality
function matricesEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i].length !== b[i].length) return false;
        for (let j = 0; j < a[i].length; j++) {
            if (a[i][j] !== b[i][j]) return false;
        }
    }
    return true;
}

// Board Manager (server-side)
class BoardManager {
    constructor(boardSize) {
        this.boardSize = boardSize;
        this.board = [];
    }

    createEmptyBoard() {
        this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(0));
    }

    canPlace(piece, row, col) {
        const pRows = piece.length;
        const pCols = piece[0].length;

        if (row < 0 || col < 0 || row + pRows > this.boardSize || col + pCols > this.boardSize) {
            return false;
        }

        for (let i = 0; i < pRows; i++) {
            for (let j = 0; j < pCols; j++) {
                if (piece[i][j] === 1 && this.board[row + i][col + j] === 1) {
                    return false;
                }
            }
        }
        return true;
    }

    placePiece(pieceMatrix, row, col) {
        if (!this.canPlace(pieceMatrix, row, col)) {
            return false;
        }

        for (let r = 0; r < pieceMatrix.length; r++) {
            for (let c = 0; c < pieceMatrix[0].length; c++) {
                if (pieceMatrix[r][c] === 1) {
                    this.board[row + r][col + c] = 1;
                }
            }
        }
        return true;
    }

    checkLines() {
        let rows = [];
        let cols = [];

        for (let r = 0; r < this.boardSize; r++) {
            if (this.board[r].every(val => val === 1)) {
                rows.push(r);
            }
        }

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

    clearLines(lineData) {
        const { rows, cols } = lineData;
        
        rows.forEach(r => {
            for (let c = 0; c < this.boardSize; c++) {
                this.board[r][c] = 0;
            }
        });
        
        cols.forEach(c => {
            for (let r = 0; r < this.boardSize; r++) {
                this.board[r][c] = 0;
            }
        });
    }

    simulatePlaceAndClear(board, piece, r, c) {
        for (let i = 0; i < piece.length; i++) {
            for (let j = 0; j < piece[0].length; j++) {
                if (piece[i][j] === 1) {
                    board[r + i][c + j] = 1;
                }
            }
        }
        
        let rowsToRemove = [];
        let colsToRemove = [];
        
        for (let i = 0; i < this.boardSize; i++) {
            if (board[i].every(v => v === 1)) {
                rowsToRemove.push(i);
            }
        }
        
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

        rowsToRemove.forEach(ri => {
            for (let j = 0; j < this.boardSize; j++) {
                board[ri][j] = 0;
            }
        });
        
        colsToRemove.forEach(ci => {
            for (let i = 0; i < this.boardSize; i++) {
                board[i][ci] = 0;
            }
        });
    }

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

// Piece Generator (server-side)
class PieceGenerator {
    constructor(shapeLibrary, boardManager) {
        this.shapeLibrary = shapeLibrary;
        this.boardManager = boardManager;
        
        // Pre-calculate weights for pieces based on size (number of 1s in matrix)
        // Larger pieces = higher weight = higher probability
        this.weights = this.shapeLibrary.map(shape => {
            return shape.flat().reduce((sum, cell) => sum + cell, 0);
        });
        this.totalWeight = this.weights.reduce((sum, weight) => sum + weight, 0);
    }

    /**
     * Get a random shape from the library using weighted probability
     * @returns {Array} - 2D matrix representing a shape
     */
    getWeightedRandomShape() {
        let r = Math.random() * this.totalWeight;
        for (let i = 0; i < this.shapeLibrary.length; i++) {
            r -= this.weights[i];
            if (r <= 0) {
                return this.shapeLibrary[i];
            }
        }
        // Fallback to last shape
        return this.shapeLibrary[this.shapeLibrary.length - 1];
    }

    generatePieces(nPieces, currentBoardState) {
        let result = [];
        let tempBoard = currentBoardState.map(row => [...row]);
        
        for (let i = 0; i < nPieces; i++) {
            let foundPiece = null;
            let attempts = 0;

            while (!foundPiece && attempts < MAX_GENERATION_ATTEMPTS) {
                let randomShape = this.getWeightedRandomShape();
                let rotations = this.getAllRotations(randomShape);
                rotations.sort(() => Math.random() - 0.5);

                for (let shapeVariant of rotations) {
                    let placement = this.boardManager.findValidPosition(tempBoard, shapeVariant);
                    
                    if (placement) {
                        foundPiece = {
                            matrix: shapeVariant,
                            color: COLORS[Math.floor(Math.random() * COLORS.length)],
                            id: Date.now() + Math.random()
                        };
                        
                        this.boardManager.simulatePlaceAndClear(tempBoard, foundPiece.matrix, placement.r, placement.c);
                        break; 
                    }
                }
                attempts++;
            }

            if (!foundPiece) {
                // Fallback: use random shape even if no valid position found
                let randomShape = this.getWeightedRandomShape();
                foundPiece = {
                    matrix: randomShape,
                    color: COLORS[Math.floor(Math.random() * COLORS.length)],
                    id: Date.now() + Math.random()
                };
            }
            
            // Ensure piece is valid before pushing
            if (!foundPiece || !foundPiece.matrix || !foundPiece.color) {
                // Create a fallback valid piece
                foundPiece = {
                    matrix: [[1]], // Single block as ultimate fallback
                    color: COLORS[0],
                    id: Date.now() + Math.random()
                };
            }

            result.push(foundPiece);
        }
        
        return result;
    }

    rotateMatrix(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        let newMatrix = Array(cols).fill().map(() => Array(rows).fill(0));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                newMatrix[c][rows - 1 - r] = matrix[r][c];
            }
        }
        return newMatrix;
    }

    getAllRotations(matrix) {
        let rotations = [];
        let curr = matrix;
        for (let i = 0; i < 4; i++) {
            let str = JSON.stringify(curr);
            if (!rotations.some(m => JSON.stringify(m) === str)) {
                rotations.push(curr);
            }
            curr = this.rotateMatrix(curr);
        }
        return rotations;
    }
}

// Top Rank File Management
const TOP_RANK_FILE = path.join(__dirname, 'top-rank.json');

async function loadTopRank() {
    try {
        const data = await fs.readFile(TOP_RANK_FILE, 'utf8');
        const ranks = JSON.parse(data);
        // Check if ranks is a valid array
        if (Array.isArray(ranks)) {
            return ranks;
        }
        // If it's a single object (legacy), wrap it in an array
        if (ranks && typeof ranks === 'object' && typeof ranks.score === 'number') {
            return [ranks];
        }
        return [];
    } catch (e) {
        if (e.code === 'ENOENT') {
            // File doesn't exist, create empty file with empty array
            try {
                await fs.writeFile(TOP_RANK_FILE, JSON.stringify([], null, 2), 'utf8');
            } catch (writeErr) {
                console.error('Error creating top-rank.json file:', writeErr);
            }
        } else {
            console.error('Error loading top rank:', e);
        }
    }
    return [];
}

// Initialize top-rank.json file on server start
async function initializeTopRankFile() {
    try {
        const ranks = await loadTopRank();
        if (ranks.length > 0) {
            console.log(`Top rank loaded: ${ranks.length} records, highest: ${ranks[0].score}`);
        } else {
            console.log('Top rank file initialized (no existing records)');
        }
    } catch (e) {
        console.error('Error initializing top-rank.json file:', e);
    }
}

async function saveTopRank(name, score) {
    try {
        const ranks = await loadTopRank();
        const newRank = {
            name: name.trim() || 'Anonymous',
            score: score,
            date: new Date().toISOString()
        };
        
        ranks.push(newRank);
        // Sort by score descending
        ranks.sort((a, b) => b.score - a.score);
        
        // Keep top 10
        const top10 = ranks.slice(0, 10);
        
        await fs.writeFile(TOP_RANK_FILE, JSON.stringify(top10, null, 2), 'utf8');
        return top10;
    } catch (e) {
        console.error('Error saving top rank:', e);
        throw e;
    }
}

// API Routes - must be registered BEFORE static files
// (So API routes take precedence over static files with same path)

// Initialize new game
app.post('/api/game/init', (req, res) => {
    try {
        const sessionId = req.body.sessionId || `session-${Date.now()}-${Math.random()}`;
        
        const boardManager = new BoardManager(BOARD_SIZE);
        boardManager.createEmptyBoard();
        
        const shapeLibrary = Object.values(RAW_SHAPES);
        const pieceGenerator = new PieceGenerator(shapeLibrary, boardManager);
        
        const initialPieces = pieceGenerator.generatePieces(PIECES_PER_ROUND, boardManager.board);
        initialPieces.sort(() => Math.random() - 0.5);
        
        const gameState = {
            board: boardManager.board.map(row => [...row]),
            score: 0,
            currentPieces: initialPieces,
            boardManager: boardManager,
            pieceGenerator: pieceGenerator,
            shapeLibrary: shapeLibrary,
            comboCount: 0
        };
        
        gameSessions.set(sessionId, gameState);
        
        res.json({
            success: true,
            sessionId: sessionId,
            board: gameState.board,
            score: gameState.score,
            pieces: gameState.currentPieces
        });
    } catch (error) {
        console.error('Error initializing game:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Place piece
app.post('/api/game/place', (req, res) => {
    try {
        const { sessionId, piece, x, y } = req.body;
        
        if (!sessionId || !piece || typeof x !== 'number' || typeof y !== 'number') {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        const gameState = gameSessions.get(sessionId);
        if (!gameState) {
            return res.status(404).json({ success: false, error: 'Game session not found' });
        }
        
        // Validate piece is one of the current pieces (and not already used)
        const pieceMatrix = piece.matrix;
        let pieceIndex = -1;
        for (let i = 0; i < gameState.currentPieces.length; i++) {
            if (gameState.currentPieces[i] !== null && matricesEqual(gameState.currentPieces[i].matrix, pieceMatrix)) {
                pieceIndex = i;
                break;
            }
        }
        
        if (pieceIndex === -1) {
            return res.status(400).json({ success: false, error: 'Invalid piece - not in current pieces or already used' });
        }
        
        const { boardManager } = gameState;
        
        // Validate coordinates are within bounds
        const pRows = pieceMatrix.length;
        const pCols = pieceMatrix[0].length;
        if (x < 0 || y < 0 || x + pRows > BOARD_SIZE || y + pCols > BOARD_SIZE) {
            return res.status(400).json({ 
                success: false, 
                error: `Invalid coordinates: x=${x}, y=${y}, piece size=${pRows}x${pCols}, board size=${BOARD_SIZE}` 
            });
        }
        
        // Try to place piece
        if (!boardManager.canPlace(pieceMatrix, x, y)) {
            return res.status(400).json({ 
                success: false, 
                error: `Cannot place piece at position (${x}, ${y}) - position is invalid or overlaps with existing blocks` 
            });
        }
        
        // Place piece on board
        const placed = boardManager.placePiece(pieceMatrix, x, y);
        if (!placed) {
            return res.status(400).json({ success: false, error: 'Failed to place piece' });
        }
        
        // Calculate base score
        const blockCount = pieceMatrix.flat().filter(x => x === 1).length;
        gameState.score += blockCount * BASE_POINTS_PER_BLOCK;
        
        // Check for completed lines
        const lineData = boardManager.checkLines();
        let lineClearScore = 0;
        let comboInfo = null;

        if (lineData.rows.length > 0 || lineData.cols.length > 0) {
            const count = lineData.rows.length + lineData.cols.length;
            lineClearScore = (count * LINE_CLEAR_BASE_POINTS) + LINE_CLEAR_MULTIPLIER * count * (count - 1);
            gameState.score += lineClearScore;
            boardManager.clearLines(lineData);

            // Update combo
            gameState.comboCount++;
            if (gameState.comboCount > 1) {
                const comboLevel = gameState.comboCount - 1;
                const comboBonus = 5 * comboLevel;
                gameState.score += comboBonus;
                comboInfo = { level: comboLevel, bonus: comboBonus };
            }
        } else {
            // Reset combo if no lines cleared
            gameState.comboCount = 0;
        }
        
        // Remove placed piece (set to null)
        gameState.currentPieces[pieceIndex] = null;
        
        // Check game over based on remaining pieces
        const activePieces = gameState.currentPieces.filter(p => p !== null);
        let isGameOver = false;
        if (activePieces.length > 0) {
            // Check if any remaining piece can be placed
            isGameOver = true;
            for (let piece of activePieces) {
                if (boardManager.findValidPosition(boardManager.board, piece.matrix)) {
                    isGameOver = false;
                    break;
                }
            }
        } else {
            // No pieces left - game continues, client should request new pieces
            isGameOver = false;
        }
        
        res.json({
            success: true,
            board: boardManager.board.map(row => [...row]),
            score: gameState.score,
            pieces: gameState.currentPieces, // Array of 3 (may contain nulls for placed pieces)
            lineCleared: lineData,
            lineClearScore: lineClearScore,
            comboInfo: comboInfo,
            isGameOver: isGameOver
        });
    } catch (error) {
        console.error('Error placing piece:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Request new pieces (only if all current pieces are used)
app.post('/api/game/requestNewPieces', (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ success: false, error: 'Missing sessionId' });
        }
        
        const gameState = gameSessions.get(sessionId);
        if (!gameState) {
            return res.status(404).json({ success: false, error: 'Game session not found' });
        }
        
        // Check if all current pieces are used (all null)
        const allPiecesUsed = gameState.currentPieces.every(p => p === null);
        
        if (!allPiecesUsed) {
            return res.status(400).json({ 
                success: false, 
                error: 'Cannot request new pieces - current pieces are not all used yet',
                remainingPieces: gameState.currentPieces.filter(p => p !== null).length
            });
        }
        
        // Generate new pieces
        const { boardManager } = gameState;
        const newPieces = gameState.pieceGenerator.generatePieces(PIECES_PER_ROUND, boardManager.board);
        newPieces.sort(() => Math.random() - 0.5);
        
        // Validate pieces
        if (newPieces.length !== PIECES_PER_ROUND) {
            return res.status(500).json({ success: false, error: 'Failed to generate pieces' });
        }
        
        const validPieces = newPieces.filter(p => p !== null && p !== undefined && p.matrix && p.color);
        if (validPieces.length !== PIECES_PER_ROUND) {
            return res.status(500).json({ success: false, error: 'Failed to generate valid pieces' });
        }
        
        // Update current pieces
        gameState.currentPieces = newPieces;
        res.json({
            success: true,
            pieces: newPieces
        });
    } catch (error) {
        console.error('Error requesting new pieces:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get current game state
app.get('/api/game/state/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const gameState = gameSessions.get(sessionId);
        
        if (!gameState) {
            return res.status(404).json({ success: false, error: 'Game session not found' });
        }
        
        res.json({
            success: true,
            board: gameState.boardManager.board.map(row => [...row]),
            score: gameState.score,
            pieces: gameState.currentPieces
        });
    } catch (error) {
        console.error('Error getting game state:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get top rank
app.get('/api/rank', async (req, res) => {
    try {
        const topRank = await loadTopRank();
        res.json({ success: true, rank: topRank });
    } catch (error) {
        console.error('Error getting top rank:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save top rank
app.post('/api/rank', async (req, res) => {
    try {
        const { name, score } = req.body;
        
        if (!name || typeof score !== 'number') {
            return res.status(400).json({ success: false, error: 'Missing name or score' });
        }
        
        const ranks = await loadTopRank();
        const isTop10 = ranks.length < 10 || score > ranks[ranks.length - 1].score;
        
        if (!isTop10) {
            return res.status(400).json({ success: false, error: 'Score does not qualify for top 10' });
        }
        
        const updatedRanks = await saveTopRank(name, score);
        res.json({ success: true, rank: updatedRanks[0], ranks: updatedRanks });
    } catch (error) {
        console.error('Error saving top rank:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve static files AFTER API routes
// Serve JS files with explicit route first to ensure correct MIME type
app.get('/js/:filename', (req, res, next) => {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, 'js', filename);
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.sendFile(filepath, (err) => {
        if (err) {
            next(); // Pass to next middleware if file not found
        }
    });
});

// Serve CSS files with explicit route
app.get('/css/:filename', (req, res, next) => {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, 'css', filename);
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.sendFile(filepath, (err) => {
        if (err) {
            next(); // Pass to next middleware if file not found
        }
    });
});

// Serve images
app.get('/images/:filename', (req, res, next) => {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, 'images', filename);
    res.sendFile(filepath, (err) => {
        if (err) {
            next(); // Pass to next middleware if file not found
        }
    });
});

// Serve other static files
app.use(express.static(path.join(__dirname)));

// Catch-all handler: serve index.html for any non-API routes (for SPA)
app.get('*', (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'API endpoint not found' });
    }
    // Serve index.html for all other routes
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, async () => {
    console.log(`Brik Brik server running on http://localhost:${PORT}`);
    // Initialize top-rank.json file on startup
    await initializeTopRankFile();
});
