/**
 * MAIN GAME CLASS
 * Orchestrates all game components and manages game flow
 */
class PuzzleGame {
    constructor() {
        // Initialize board manager
        this.boardManager = new BoardManager(BOARD_SIZE);
        
        // Initialize piece generator
        const shapeLibrary = Object.values(RAW_SHAPES);
        this.pieceGenerator = new PieceGenerator(shapeLibrary, this.boardManager);
        
        // Initialize canvas renderer
        this.renderer = new CanvasRenderer('board-canvas', BOARD_SIZE);
        this.renderer.onResize = () => this.renderBoard();
        
        // Initialize drag and drop handler
        this.dragHandler = new DragDropHandler(this);
        
        // Game state
        this.score = 0;
        this.currentPieces = [null, null, null]; // 3 current pieces
        this.highlightData = null; // For preview highlighting
        
        // DOM elements
        this.scoreEl = document.getElementById('score');
        this.finalScoreEl = document.getElementById('final-score');
        this.gameOverModal = document.getElementById('game-over-modal');
        this.slots = [
            document.getElementById('slot-0'),
            document.getElementById('slot-1'),
            document.getElementById('slot-2')
        ];

        this.init();
    }

    /**
     * Initialize game
     */
    init() {
        // Create empty board
        this.boardManager.createEmptyBoard();
        this.score = 0;
        this.updateScoreUI();
        this.gameOverModal.classList.add('hidden');
        
        // Spawn first round
        this.spawnNewPieces();
        
        // Render UI
        this.renderBoard();
        
        // Setup drag and drop events
        this.dragHandler.setupDragEvents();
    }

    /**
     * Reset game
     */
    resetGame() {
        this.init();
    }

    /**
     * Spawn new pieces for the current round
     */
    spawnNewPieces() {
        const newPieces = this.pieceGenerator.generatePieces(PIECES_PER_ROUND, this.boardManager.board);
        // shuffle the pieces
        newPieces.sort(() => Math.random() - 0.5);
        this.currentPieces = newPieces;
        this.renderPieces();
        this.checkGameOver();
    }

    /**
     * Check if game is over (no valid moves)
     */
    checkGameOver() {
        // Check if any piece can be placed on current board
        let canMove = false;
        
        // Only check pieces that haven't been placed yet (not null)
        const activePieces = this.currentPieces.filter(p => p !== null);
        
        if (activePieces.length === 0) return; // All placed, will spawn new ones soon

        for (let piece of activePieces) {
            if (this.boardManager.findValidPosition(this.boardManager.board, piece.matrix)) {
                canMove = true;
                break;
            }
        }

        if (!canMove) {
            this.finalScoreEl.innerText = this.score;
            this.gameOverModal.classList.remove('hidden');
        }
    }

    /**
     * Get board coordinates from anchor point position (canvas-based)
     * Anchor point is the center of the piece, always at cursor/finger position
     * @param {number} anchorX - Screen X coordinate of anchor point
     * @param {number} anchorY - Screen Y coordinate of anchor point
     * @param {Array} pieceMatrix - Piece matrix
     * @returns {Object} - {r, c} board coordinates
     */
    getBoardCoordsFromAnchor(anchorX, anchorY, pieceMatrix) {
        return this.renderer.getBoardCoordsFromAnchor(anchorX, anchorY, pieceMatrix);
    }

    /**
     * Try to place a piece using anchor point
     * @param {number} anchorX - Anchor point X coordinate
     * @param {number} anchorY - Anchor point Y coordinate
     * @param {Object} piece - Piece object to place
     * @returns {Promise<boolean>} - True if placement was successful
     */
    async tryPlacePiece(anchorX, anchorY, piece) {
        const coords = this.getBoardCoordsFromAnchor(anchorX, anchorY, piece.matrix);

        // Try to place
        if (this.boardManager.placePiece(piece.matrix, coords.r, coords.c)) {
            // Placement successful
            // Add base points for placing piece (1 point per block)
            const blockCount = piece.matrix.flat().filter(x => x === 1).length;
            this.score += blockCount * BASE_POINTS_PER_BLOCK;
            this.updateScoreUI();
            this.clearHighlight();
            this.renderBoard(); // Render board with new piece
            
            // Check for completed lines
            const lineData = this.boardManager.checkLines();
            if (lineData.rows.length > 0 || lineData.cols.length > 0) {
                this.reward(lineData);
                await this.deleteLines(lineData);
            }
            
            return true;
        }
        return false;
    }

    /**
     * Calculate and award points for clearing lines
     * @param {Object} lineData - {rows: [indices], cols: [indices]}
     * @returns {boolean} - True if points were awarded
     */
    reward(lineData) {
        const count = lineData.rows.length + lineData.cols.length;
        if (count > 0) {
            // Formula: (number of lines * 10) + 2 * (number of lines) * (number of lines - 1)
            let points = (count * LINE_CLEAR_BASE_POINTS) + LINE_CLEAR_MULTIPLIER * count * (count - 1);
            this.score += points;
            this.updateScoreUI();
            return true;
        }
        return false;
    }

    /**
     * Delete lines with animation
     * @param {Object} lineData - {rows: [indices], cols: [indices]}
     * @returns {Promise<Array>} - Updated board state
     */
    async deleteLines(lineData) {
        const { rows, cols } = lineData;
        if (rows.length === 0 && cols.length === 0) {
            return this.boardManager.board;
        }

        // UI animation before clearing data
        await this.animateClearing(rows, cols);

        // Clear logic
        this.boardManager.clearLines(lineData);

        this.renderBoard();
        return this.boardManager.board;
    }


    /**
     * Highlight preview of piece placement on canvas
     * @param {number} anchorX - Anchor point X coordinate
     * @param {number} anchorY - Anchor point Y coordinate
     * @param {Object} piece - Piece object
     */
    highlightPreview(anchorX, anchorY, piece) {
        const coords = this.getBoardCoordsFromAnchor(anchorX, anchorY, piece.matrix);
        
        // Check if position is valid
        if (this.boardManager.canPlace(piece.matrix, coords.r, coords.c)) {
            // Create highlight data
            const highlightCells = [];
            for (let i = 0; i < piece.matrix.length; i++) {
                for (let j = 0; j < piece.matrix[0].length; j++) {
                    if (piece.matrix[i][j] === 1) {
                        highlightCells.push({ r: coords.r + i, c: coords.c + j });
                    }
                }
            }
            this.highlightData = { cells: highlightCells };
        } else {
            this.highlightData = null;
        }
        
        this.renderBoard();
    }

    /**
     * Clear highlight from board
     */
    clearHighlight() {
        this.highlightData = null;
        this.renderBoard();
    }

    /**
     * Animate clearing of lines on canvas
     * @param {Array} rows - Array of row indices to clear
     * @param {Array} cols - Array of column indices to clear
     * @returns {Promise} - Resolves after animation completes
     */
    async animateClearing(rows, cols) {
        return new Promise((resolve) => {
            this.renderer.animateClearing(rows, cols, () => {
                resolve();
            });
            
            // Redraw during animation
            const animate = () => {
                this.renderBoard();
                if (this.renderer.clearingCells.size > 0) {
                    requestAnimationFrame(animate);
                }
            };
            animate();
        });
    }

    // --- UI RENDERING ---

    /**
     * Update score display
     */
    updateScoreUI() {
        this.scoreEl.innerText = this.score;
    }

    /**
     * Render the game board on canvas
     */
    renderBoard() {
        this.renderer.drawBoard(this.boardManager.board, this.highlightData);
        
        // Draw ghost piece if dragging
        if (this.dragHandler && this.dragHandler.isDragging && this.dragHandler.draggedPiece) {
            const piece = this.dragHandler.draggedPiece;
            const anchorScreenX = this.dragHandler.anchorPointX;
            const anchorScreenY = this.dragHandler.anchorPointY;
            const color = this.renderer.getColorFromClass(piece.color);
            
            // Convert screen coordinates to canvas coordinates
            const rect = this.renderer.canvas.getBoundingClientRect();
            const anchorCanvasX = anchorScreenX - rect.left;
            const anchorCanvasY = anchorScreenY - rect.top;
            
            // Draw ghost piece with slight transparency and shadow
            this.renderer.ctx.save();
            this.renderer.ctx.globalAlpha = 0.8;
            this.renderer.drawPiece(piece.matrix, anchorCanvasX, anchorCanvasY, color, 1, true);
            this.renderer.ctx.restore();
        }
    }

    /**
     * Render pieces in the pieces area
     */
    renderPieces() {
        this.slots.forEach((slot, index) => {
            slot.innerHTML = '';
            const pieceData = this.currentPieces[index];
            if (pieceData) {
                const pieceEl = this.createPieceElement(pieceData, index);
                slot.appendChild(pieceEl);
            }
        });
    }

    /**
     * Create DOM element for a piece
     * @param {Object} pieceData - Piece object with matrix and color
     * @param {number} index - Index of piece in currentPieces array
     * @returns {HTMLElement} - Piece DOM element
     */
    createPieceElement(pieceData, index) {
        const matrix = pieceData.matrix;
        const rows = matrix.length;
        const cols = matrix[0].length;
        
        const container = document.createElement('div');
        container.className = 'piece relative cursor-move';
        // Ensure each piece has a unique identifier to prevent overlap
        container.id = `piece-${index}-${Date.now()}-${Math.random()}`;
        // Calculate grid style for small piece display
        container.style.display = 'grid';
        container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        const gap = 2;
        container.style.gap = `${gap}px`;
        
        // Display size in tray - larger on mobile for easier touch
        const cellSize = IS_MOBILE ? PIECE_DISPLAY_CELL_SIZE_MOBILE : PIECE_DISPLAY_CELL_SIZE;
        const MIN_TOUCH_SIZE = 44; // Minimum touch target size
        
        // Get slot dimensions to ensure piece fits
        const slot = this.slots[index];
        const slotRect = slot.getBoundingClientRect();
        // Account for padding (p-2 sm:p-3 = 8px mobile, 12px desktop)
        const slotPadding = IS_MOBILE ? 8 : 12;
        const maxSlotWidth = slotRect.width - slotPadding * 2;
        const maxSlotHeight = slotRect.height - slotPadding * 2;
        
        // Calculate base dimensions (without gap)
        const baseWidth = cols * cellSize;
        const baseHeight = rows * cellSize;
        
        // Calculate total dimensions including gaps
        const totalWidth = baseWidth + (cols > 1 ? (cols - 1) * gap : 0);
        const totalHeight = baseHeight + (rows > 1 ? (rows - 1) * gap : 0);
        
        // Calculate scale factors for different constraints
        let scaleFactor = 1;
        
        // 1. Scale to meet minimum touch size (check both dimensions)
        if (totalWidth < MIN_TOUCH_SIZE) {
            const scaleForWidth = MIN_TOUCH_SIZE / totalWidth;
            scaleFactor = Math.max(scaleFactor, scaleForWidth);
        }
        if (totalHeight < MIN_TOUCH_SIZE) {
            const scaleForHeight = MIN_TOUCH_SIZE / totalHeight;
            scaleFactor = Math.max(scaleFactor, scaleForHeight);
        }
        
        // 2. Scale down if piece exceeds slot dimensions (maintain aspect ratio)
        const scaledWidth = totalWidth * scaleFactor;
        const scaledHeight = totalHeight * scaleFactor;
        
        if (scaledWidth > maxSlotWidth) {
            const scaleToFitWidth = maxSlotWidth / totalWidth;
            scaleFactor = Math.min(scaleFactor, scaleToFitWidth);
        }
        if (scaledHeight > maxSlotHeight) {
            const scaleToFitHeight = maxSlotHeight / totalHeight;
            scaleFactor = Math.min(scaleFactor, scaleToFitHeight);
        }
        
        // Apply final scaled dimensions (maintain aspect ratio)
        const finalWidth = baseWidth * scaleFactor;
        const finalHeight = baseHeight * scaleFactor;
        
        container.style.width = `${finalWidth}px`;
        container.style.height = `${finalHeight}px`;

        container.dataset.index = index;

        // Render child blocks
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const block = document.createElement('div');
                if (matrix[r][c] === 1) {
                    block.className = `w-full h-full rounded-sm ${pieceData.color}`;
                } else {
                    block.className = 'w-full h-full opacity-0';
                }
                container.appendChild(block);
            }
        }

        return container;
    }
}

