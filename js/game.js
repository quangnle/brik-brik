/**
 * MAIN GAME CLASS
 * Orchestrates all game components and manages game flow
 * Now uses server-side API for game state management
 */
class PuzzleGame {
    constructor() {
        // Initialize API client
        this.apiClient = new APIClient();
        
        // Initialize canvas renderer (for display only)
        this.renderer = new CanvasRenderer('board-canvas', BOARD_SIZE);
        this.renderer.onResize = () => this.renderBoard();
        
        // Initialize drag and drop handler
        this.dragHandler = new DragDropHandler(this);
        
        // Initialize rank manager (uses API)
        this.rankManager = new RankManager(this.apiClient);
        
        // Game state (synced from server)
        this.board = []; // 2D array representing board
        this.score = 0;
        this.currentPieces = [null, null, null]; // 3 current pieces
        this.highlightData = null; // For preview highlighting
        this.isRenderingPieces = false; // Flag to prevent concurrent renders
        
        // DOM elements
        this.scoreEl = document.getElementById('score');
        this.finalScoreEl = document.getElementById('final-score');
        this.gameOverModal = document.getElementById('game-over-modal');
        this.recordModal = document.getElementById('record-modal');
        this.recordNameInput = document.getElementById('record-name-input');
        this.topRankEl = document.getElementById('top-rank');
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
    async init() {
        try {
            // Hide modals
            this.gameOverModal.classList.add('hidden');
            this.recordModal?.classList.add('hidden');
            
            // Initialize game on server
            const gameData = await this.apiClient.initGame();
            
            // Update local state
            this.board = gameData.board;
            this.score = gameData.score;
            this.currentPieces = gameData.pieces;
            
            // Update UI
            this.updateScoreUI();
            this.renderBoard();
            this.renderPieces();
            
            // Load and display top rank
            await this.updateTopRankDisplay();
            
            // Setup drag and drop events
            this.dragHandler.setupDragEvents();
        } catch (error) {
            console.error('Error initializing game:', error);
            alert('Failed to initialize game. Please refresh the page.');
        }
    }

    /**
     * Reset game
     */
    resetGame() {
        this.init();
    }

    /**
     * Try to place a piece using anchor point
     * @param {number} anchorX - Anchor point X coordinate
     * @param {number} anchorY - Anchor point Y coordinate
     * @param {Object} piece - Piece object to place
     * @returns {Promise<boolean>} - True if placement was successful
     */
    async tryPlacePiece(anchorX, anchorY, piece) {
        try {
            const coords = this.getBoardCoordsFromAnchor(anchorX, anchorY, piece.matrix);
            
            // Validate coordinates before sending to server
            const pRows = piece.matrix.length;
            const pCols = piece.matrix[0].length;
            if (coords.r < 0 || coords.c < 0 || 
                coords.r + pRows > BOARD_SIZE || coords.c + pCols > BOARD_SIZE) {
                return false;
            }
            
            // Call server API to place piece (x = row, y = col)
            const result = await this.apiClient.placePiece(piece, coords.r, coords.c);
            
            if (result.success) {
                // Update local state from server response
                this.board = result.board;
                this.score = result.score;
                
                // Server always sends array of exactly 3 elements (may contain nulls)
                if (result.pieces && Array.isArray(result.pieces)) {
                    // Ensure we have exactly 3 slots
                    this.currentPieces = result.pieces.length === PIECES_PER_ROUND 
                        ? result.pieces 
                        : [...result.pieces, ...Array(Math.max(0, PIECES_PER_ROUND - result.pieces.length)).fill(null)].slice(0, PIECES_PER_ROUND);
                } else {
                    this.currentPieces = [null, null, null];
                }
                
                // Update UI
                this.updateScoreUI();
                this.clearHighlight();
                this.renderBoard();
                
                // Handle line clearing animation if lines were cleared
                if (result.lineCleared && (result.lineCleared.rows.length > 0 || result.lineCleared.cols.length > 0)) {
                    await this.deleteLines(result.lineCleared);
                }
                
                // Check if all pieces are used - if so, request new pieces
                const allPiecesUsed = this.currentPieces.every(p => p === null);
                if (allPiecesUsed) {
                    try {
                        const newPiecesResult = await this.apiClient.requestNewPieces();
                        if (newPiecesResult.success && newPiecesResult.pieces) {
                            // Ensure we have exactly 3 pieces
                            if (Array.isArray(newPiecesResult.pieces) && newPiecesResult.pieces.length === PIECES_PER_ROUND) {
                                this.currentPieces = newPiecesResult.pieces;
                            }
                        }
                    } catch (error) {
                        console.error('Error requesting new pieces:', error);
                        // Continue anyway - pieces will stay empty
                    }
                }
                
                // Always render pieces after updating (remove placed piece or show new pieces)
                this.renderPieces();
                
                // Check game over
                if (result.isGameOver) {
                    this.finalScoreEl.innerText = this.score;
                    // Check if this is a new record
                    const isNewRecord = await this.rankManager.isNewRecord(this.score);
                    if (isNewRecord) {
                        this.showRecordModal();
                    } else {
                        this.gameOverModal.classList.remove('hidden');
                    }
                } else {
                    // Check game over with current pieces
                    this.checkGameOver();
                }
                
                return true;
            } else {
                // Placement failed - server returned error
                return false;
            }
        } catch (error) {
            console.error('Error placing piece:', error);
            // Silently fail - user will see piece return to original position
            return false;
        }
    }

    /**
     * Check if game is over (client-side check as fallback)
     * Note: Server also checks and returns isGameOver flag
     */
    checkGameOver() {
        // This is mainly a fallback check
        // Server should handle the main game over logic
        const activePieces = this.currentPieces.filter(p => p !== null);
        if (activePieces.length === 0) return; // All placed, will spawn new ones soon
        
        // For client-side preview, we can use a simple board check
        // But server is authoritative
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
     * Delete lines with animation
     * @param {Object} lineData - {rows: [indices], cols: [indices]}
     * @returns {Promise<Array>} - Updated board state
     */
    async deleteLines(lineData) {
        const { rows, cols } = lineData;
        if (rows.length === 0 && cols.length === 0) {
            return this.board;
        }

        // UI animation before clearing data
        await this.animateClearing(rows, cols);

        // Board is already updated from server response
        this.renderBoard();
        return this.board;
    }

    /**
     * Highlight preview of piece placement on canvas
     * @param {number} anchorX - Anchor point X coordinate
     * @param {number} anchorY - Anchor point Y coordinate
     * @param {Object} piece - Piece object
     */
    highlightPreview(anchorX, anchorY, piece) {
        const coords = this.getBoardCoordsFromAnchor(anchorX, anchorY, piece.matrix);
        
        // Validate coordinates are within bounds first
        const pRows = piece.matrix.length;
        const pCols = piece.matrix[0].length;
        if (coords.r < 0 || coords.c < 0 || 
            coords.r + pRows > BOARD_SIZE || coords.c + pCols > BOARD_SIZE) {
            this.highlightData = null;
            this.renderBoard();
            return;
        }
        
        // Create a temporary board manager for validation
        // We'll create a simple canPlace check using current board state
        if (this.canPlaceOnBoard(this.board, piece.matrix, coords.r, coords.c)) {
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
     * Check if piece can be placed on board (client-side preview validation)
     * @param {Array} board - Board state
     * @param {Array} piece - Piece matrix
     * @param {number} row - Row position
     * @param {number} col - Column position
     * @returns {boolean}
     */
    canPlaceOnBoard(board, piece, row, col) {
        if (!board || !piece || !piece.length || !piece[0]) {
            return false;
        }
        
        const pRows = piece.length;
        const pCols = piece[0].length;

        // Check bounds
        if (row < 0 || col < 0 || row + pRows > BOARD_SIZE || col + pCols > BOARD_SIZE) {
            return false;
        }

        // Check overlap with existing blocks
        for (let i = 0; i < pRows; i++) {
            const boardRow = board[row + i];
            if (!boardRow) {
                return false; // Board row doesn't exist (shouldn't happen but safe check)
            }
            for (let j = 0; j < pCols; j++) {
                if (piece[i][j] === 1 && boardRow[col + j] === 1) {
                    return false; // Overlap detected
                }
            }
        }
        return true;
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
     * Update top rank display in UI
     */
    async updateTopRankDisplay() {
        const topRank = await this.rankManager.getTopRank();
        if (this.topRankEl) {
            if (topRank) {
                this.topRankEl.innerHTML = `
                    <div class="text-xs text-slate-400">TOP RECORD</div>
                    <div class="text-sm font-bold text-yellow-400">${topRank.name}: ${topRank.score}</div>
                `;
            } else {
                this.topRankEl.innerHTML = `
                    <div class="text-xs text-slate-400">TOP RECORD</div>
                    <div class="text-sm font-bold text-slate-500">No record yet</div>
                `;
            }
        }
    }

    /**
     * Show record modal when new record is achieved
     */
    showRecordModal() {
        if (this.recordModal) {
            const recordScoreEl = document.getElementById('record-score');
            if (recordScoreEl) {
                recordScoreEl.innerText = this.score;
            }
            this.recordModal.classList.remove('hidden');
            // Focus on input field
            if (this.recordNameInput) {
                setTimeout(() => {
                    this.recordNameInput.focus();
                }, 100);
            }
        }
    }

    /**
     * Save new record with player name
     */
    async saveRecord() {
        const name = this.recordNameInput?.value || 'Anonymous';
        try {
            if (await this.rankManager.saveTopRank(name, this.score)) {
                await this.updateTopRankDisplay();
                // Hide record modal and show game over modal
                if (this.recordModal) {
                    this.recordModal.classList.add('hidden');
                }
                this.gameOverModal.classList.remove('hidden');
                // Clear input for next time
                if (this.recordNameInput) {
                    this.recordNameInput.value = '';
                }
            }
        } catch (error) {
            console.error('Error saving record:', error);
            alert('Failed to save record. Please try again.');
        }
    }

    /**
     * Render the game board on canvas
     */
    renderBoard() {
        this.renderer.drawBoard(this.board, this.highlightData);
        
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
        // Prevent concurrent renders
        if (this.isRenderingPieces) {
            return;
        }
        
        this.isRenderingPieces = true;
        
        try {
            // Clear all slots first
            this.slots.forEach(slot => {
                slot.innerHTML = '';
            });
        
        // Render each piece
        this.slots.forEach((slot, index) => {
            if (index >= this.currentPieces.length) {
                return;
            }
            
            const pieceData = this.currentPieces[index];
            if (!pieceData) {
                // Piece is null/undefined - slot stays empty
                return;
            }
            
            // Validate piece has required properties
            if (!pieceData.matrix || !pieceData.color) {
                return;
            }
            
            // Validate matrix is valid 2D array
            if (!Array.isArray(pieceData.matrix) || pieceData.matrix.length === 0) {
                return;
            }
            
            try {
                const pieceEl = this.createPieceElement(pieceData, index);
                
                if (pieceEl) {
                    slot.appendChild(pieceEl);
                    // Force a reflow to ensure DOM is updated
                    void slot.offsetHeight;
                }
            } catch (error) {
                console.error(`Error creating piece element for index ${index}:`, error);
            }
        });
        
        requestAnimationFrame(() => {
            // Release render lock
            this.isRenderingPieces = false;
        });
        } catch (error) {
            console.error('Error in renderPieces:', error);
            this.isRenderingPieces = false;
        }
    }

    /**
     * Create DOM element for a piece
     * @param {Object} pieceData - Piece object with matrix and color
     * @param {number} index - Index of piece in currentPieces array
     * @returns {HTMLElement} - Piece DOM element
     */
    createPieceElement(pieceData, index) {
        if (!pieceData || !pieceData.matrix) {
            return null;
        }
        
        const matrix = pieceData.matrix;
        if (!Array.isArray(matrix) || matrix.length === 0 || !matrix[0] || !Array.isArray(matrix[0])) {
            return null;
        }
        
        const rows = matrix.length;
        const cols = matrix[0].length;
        
        if (rows === 0 || cols === 0) {
            return null;
        }
        
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
        if (!slot) {
            return null;
        }
        
        const slotRect = slot.getBoundingClientRect();
        // Account for padding (p-2 sm:p-3 = 8px mobile, 12px desktop)
        const slotPadding = IS_MOBILE ? 8 : 12;
        const maxSlotWidth = slotRect.width > 0 ? slotRect.width - slotPadding * 2 : 128;
        const maxSlotHeight = slotRect.height > 0 ? slotRect.height - slotPadding * 2 : 143;
        
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
        
        // Ensure minimum dimensions
        const minSize = 10; // Minimum 10px
        const actualWidth = Math.max(finalWidth, minSize);
        const actualHeight = Math.max(finalHeight, minSize);
        
        container.style.width = `${actualWidth}px`;
        container.style.height = `${actualHeight}px`;
        
        // Ensure piece is visible
        container.style.visibility = 'visible';
        container.style.opacity = '1';
        container.style.display = 'grid';

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
