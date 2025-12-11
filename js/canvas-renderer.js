/**
 * CANVAS RENDERER
 * Handles all rendering on canvas for board and pieces
 */
class CanvasRenderer {
    constructor(canvasId, boardSize) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.boardSize = boardSize;
        
        // Colors
        this.colors = {
            empty: '#1e293b',      // slate-800 (dark blue-black)
            filled: '#2563eb',     // blue-600
            highlight: 'rgba(34, 197, 94, 0.5)', // green glow
            clearing: '#fbbf24',   // yellow flash
            background: '#475569', // slate-700
            grid: '#64748b'       // slate-500
        };
        
        // Setup canvas
        this.setupCanvas();
        
        // Animation state
        this.clearingCells = new Set();
        this.clearingAnimations = new Map(); // Store animation data for each cell
        this.animationFrame = null;
    }

    /**
     * Setup canvas with proper sizing
     */
    setupCanvas() {
        const container = this.canvas.parentElement;
        const resize = () => {
            const containerRect = container.getBoundingClientRect();
            const padding = 8; // Padding from container
            const size = Math.min(containerRect.width - padding * 2, containerRect.height - padding * 2);
            
            // Set canvas size (in pixels, not CSS)
            this.canvas.width = size;
            this.canvas.height = size;
            this.canvas.style.width = size + 'px';
            this.canvas.style.height = size + 'px';
            
            // Calculate cell size and gap
            // Total gap space = (boardSize + 1) * gap
            // Available space = size - total gap
            // cellSize = available space / boardSize
            this.gap = 2; // Gap between cells
            const totalGapSpace = (this.boardSize + 1) * this.gap;
            const availableSpace = size - totalGapSpace;
            this.cellSize = availableSpace / this.boardSize;
            
            // Redraw
            if (this.onResize) {
                this.onResize();
            }
        };
        
        resize();
        window.addEventListener('resize', resize);
    }

    /**
     * Clear the entire canvas
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Draw the game board
     * @param {Array} board - 2D array representing board state
     * @param {Object} highlightData - {cells: [{r, c}, ...]} cells to highlight
     */
    drawBoard(board, highlightData = null) {
        this.clear();
        
        // Draw background
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Create set of highlighted cells for quick lookup
        const highlightedSet = new Set();
        if (highlightData && highlightData.cells) {
            highlightData.cells.forEach(cell => {
                highlightedSet.add(`${cell.r}-${cell.c}`);
            });
        }
        
        // Draw cells
        for (let r = 0; r < this.boardSize; r++) {
            for (let c = 0; c < this.boardSize; c++) {
                const x = c * (this.cellSize + this.gap) + this.gap;
                const y = r * (this.cellSize + this.gap) + this.gap;
                
                // Check if cell is highlighted
                const cellKey = `${r}-${c}`;
                const isHighlighted = highlightedSet.has(cellKey);
                const isClearing = this.clearingCells.has(cellKey);
                const animData = this.clearingAnimations.get(cellKey);
                
                // Draw cell
                this.ctx.save();
                
                if (isClearing && animData) {
                    // Apply animation transformations
                    const centerX = x + this.cellSize / 2;
                    const centerY = y + this.cellSize / 2;
                    
                    this.ctx.translate(centerX, centerY);
                    this.ctx.rotate(animData.rotation);
                    this.ctx.scale(animData.scale, animData.scale);
                    this.ctx.translate(-centerX, -centerY);
                    
                    // Use opacity for fade effect
                    this.ctx.globalAlpha = animData.opacity;
                    this.ctx.fillStyle = this.colors.clearing;
                } else if (isHighlighted) {
                    this.ctx.fillStyle = this.colors.highlight;
                } else if (board[r][c] === 1) {
                    this.ctx.fillStyle = this.colors.filled;
                } else {
                    this.ctx.fillStyle = this.colors.empty;
                }
                
                // Draw rounded rectangle
                this.ctx.beginPath();
                const radius = 4;
                if (this.ctx.roundRect) {
                    this.ctx.roundRect(x, y, this.cellSize, this.cellSize, radius);
                } else {
                    // Fallback for browsers without roundRect
                    this.ctx.moveTo(x + radius, y);
                    this.ctx.lineTo(x + this.cellSize - radius, y);
                    this.ctx.quadraticCurveTo(x + this.cellSize, y, x + this.cellSize, y + radius);
                    this.ctx.lineTo(x + this.cellSize, y + this.cellSize - radius);
                    this.ctx.quadraticCurveTo(x + this.cellSize, y + this.cellSize, x + this.cellSize - radius, y + this.cellSize);
                    this.ctx.lineTo(x + radius, y + this.cellSize);
                    this.ctx.quadraticCurveTo(x, y + this.cellSize, x, y + this.cellSize - radius);
                    this.ctx.lineTo(x, y + radius);
                    this.ctx.quadraticCurveTo(x, y, x + radius, y);
                    this.ctx.closePath();
                }
                this.ctx.fill();
                this.ctx.restore();
            }
        }
    }

    /**
     * Draw a piece on canvas
     * @param {Array} pieceMatrix - 2D array representing piece
     * @param {number} x - X position (center)
     * @param {number} y - Y position (center)
     * @param {string} color - Color of the piece
     * @param {number} scale - Scale factor (default 1)
     * @param {boolean} withShadow - Whether to draw shadow (default false)
     */
    drawPiece(pieceMatrix, x, y, color, scale = 1, withShadow = false) {
        const rows = pieceMatrix.length;
        const cols = pieceMatrix[0].length;
        const pieceWidth = cols * this.cellSize * scale;
        const pieceHeight = rows * this.cellSize * scale;
        
        // Calculate top-left from center
        const startX = x - pieceWidth / 2;
        const startY = y - pieceHeight / 2;
        
        this.ctx.save();
        
        // Draw shadow if needed
        if (withShadow) {
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            this.ctx.shadowBlur = 15;
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 4;
        }
        
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (pieceMatrix[r][c] === 1) {
                    const blockX = startX + c * this.cellSize * scale;
                    const blockY = startY + r * this.cellSize * scale;
                    const blockSize = this.cellSize * scale;
                    
                    // Draw rounded rectangle
                    this.ctx.save();
                    this.ctx.beginPath();
                    const radius = 4;
                    if (this.ctx.roundRect) {
                        this.ctx.roundRect(blockX, blockY, blockSize, blockSize, radius);
                    } else {
                        // Fallback for browsers without roundRect
                        this.ctx.moveTo(blockX + radius, blockY);
                        this.ctx.lineTo(blockX + blockSize - radius, blockY);
                        this.ctx.quadraticCurveTo(blockX + blockSize, blockY, blockX + blockSize, blockY + radius);
                        this.ctx.lineTo(blockX + blockSize, blockY + blockSize - radius);
                        this.ctx.quadraticCurveTo(blockX + blockSize, blockY + blockSize, blockX + blockSize - radius, blockY + blockSize);
                        this.ctx.lineTo(blockX + radius, blockY + blockSize);
                        this.ctx.quadraticCurveTo(blockX, blockY + blockSize, blockX, blockY + blockSize - radius);
                        this.ctx.lineTo(blockX, blockY + radius);
                        this.ctx.quadraticCurveTo(blockX, blockY, blockX + radius, blockY);
                        this.ctx.closePath();
                    }
                    this.ctx.fillStyle = color;
                    this.ctx.fill();
                    this.ctx.restore();
                }
            }
        }
        
        // Reset shadow
        if (withShadow) {
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 0;
        }
        
        this.ctx.restore();
    }

    /**
     * Convert screen coordinates to board grid coordinates
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     * @returns {Object} - {r, c} board coordinates or null if outside board
     */
    screenToBoard(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = screenX - rect.left;
        const y = screenY - rect.top;
        
        // Check if within canvas bounds
        if (x < 0 || y < 0 || x > this.canvas.width || y > this.canvas.height) {
            return null;
        }
        
        // Convert to grid coordinates
        const c = Math.floor(x / (this.cellSize + this.gap));
        const r = Math.floor(y / (this.cellSize + this.gap));
        
        // Clamp to valid range
        if (r < 0 || r >= this.boardSize || c < 0 || c >= this.boardSize) {
            return null;
        }
        
        return { r, c };
    }

    /**
     * Convert board grid coordinates to screen coordinates (center of cell)
     * @param {number} r - Row index
     * @param {number} c - Column index
     * @returns {Object} - {x, y} screen coordinates
     */
    boardToScreen(r, c) {
        const x = c * (this.cellSize + this.gap) + this.gap + this.cellSize / 2;
        const y = r * (this.cellSize + this.gap) + this.gap + this.cellSize / 2;
        return { x, y };
    }

    /**
     * Get board coordinates for piece placement from anchor point
     * @param {number} anchorX - Anchor point X (center of piece) in screen coordinates
     * @param {number} anchorY - Anchor point Y (center of piece) in screen coordinates
     * @param {Array} pieceMatrix - Piece matrix
     * @returns {Object} - {r, c} top-left board coordinates
     */
    getBoardCoordsFromAnchor(anchorX, anchorY, pieceMatrix) {
        const rect = this.canvas.getBoundingClientRect();
        const x = anchorX - rect.left;
        const y = anchorY - rect.top;
        
        const rows = pieceMatrix.length;
        const cols = pieceMatrix[0].length;
        const pieceWidth = cols * this.cellSize;
        const pieceHeight = rows * this.cellSize;
        
        // Calculate top-left from anchor (center)
        const topLeftX = x - pieceWidth / 2;
        const topLeftY = y - pieceHeight / 2;
        
        // Convert to grid coordinates
        // Each cell position: gap + c * (cellSize + gap)
        // So: c = (x - gap) / (cellSize + gap)
        const c = Math.round((topLeftX - this.gap) / (this.cellSize + this.gap));
        const r = Math.round((topLeftY - this.gap) / (this.cellSize + this.gap));
        
        // Clamp to valid range
        const clampedC = Math.max(0, Math.min(this.boardSize - cols, c));
        const clampedR = Math.max(0, Math.min(this.boardSize - rows, r));
        
        return { r: clampedR, c: clampedC };
    }

    /**
     * Animate clearing cells with enhanced animation
     * @param {Array} rows - Array of row indices
     * @param {Array} cols - Array of column indices
     * @param {Function} callback - Callback when animation completes
     */
    animateClearing(rows, cols, callback) {
        const startTime = Date.now();
        const duration = CLEAR_ANIMATION_DURATION;
        
        // Mark cells as clearing and initialize animation data
        rows.forEach(r => {
            for (let c = 0; c < this.boardSize; c++) {
                const cellKey = `${r}-${c}`;
                this.clearingCells.add(cellKey);
                this.clearingAnimations.set(cellKey, {
                    startTime: startTime,
                    scale: 1,
                    opacity: 1,
                    rotation: 0
                });
            }
        });
        cols.forEach(c => {
            for (let r = 0; r < this.boardSize; r++) {
                const cellKey = `${r}-${c}`;
                // Avoid duplicate if cell is in both row and col
                if (!this.clearingCells.has(cellKey)) {
                    this.clearingCells.add(cellKey);
                    this.clearingAnimations.set(cellKey, {
                        startTime: startTime,
                        scale: 1,
                        opacity: 1,
                        rotation: 0
                    });
                }
            }
        });
        
        // Animate
        const animate = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Update animation properties for each cell
            this.clearingAnimations.forEach((anim, cellKey) => {
                // Scale from 1 to 1.3 then back to 0
                if (progress < 0.3) {
                    anim.scale = 1 + (progress / 0.3) * 0.3;
                } else if (progress < 0.7) {
                    anim.scale = 1.3 - ((progress - 0.3) / 0.4) * 0.3;
                } else {
                    anim.scale = 1 - ((progress - 0.7) / 0.3);
                }
                
                // Opacity fade out
                anim.opacity = 1 - progress;
                
                // Slight rotation for effect
                anim.rotation = progress * Math.PI * 0.5;
            });
            
            if (progress < 1) {
                this.animationFrame = requestAnimationFrame(animate);
            } else {
                // Clear clearing cells and animations
                this.clearingCells.clear();
                this.clearingAnimations.clear();
                if (callback) callback();
            }
        };
        
        this.animationFrame = requestAnimationFrame(animate);
    }

    /**
     * Get color from Tailwind class name
     * @param {string} colorClass - Tailwind color class
     * @returns {string} - Hex color code
     */
    getColorFromClass(colorClass) {
        const colorMap = {
            'bg-cyan-500': '#06b6d4',
            'bg-blue-500': '#3b82f6',
            'bg-orange-500': '#f97316',
            'bg-yellow-500': '#eab308',
            'bg-green-500': '#22c55e',
            'bg-purple-500': '#a855f7',
            'bg-red-500': '#ef4444',
            'bg-pink-500': '#ec4899'
        };
        return colorMap[colorClass] || '#3b82f6';
    }
}

