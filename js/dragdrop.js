/**
 * DRAG AND DROP HANDLER
 * Manages drag and drop interactions for pieces
 */
class DragDropHandler {
    constructor(game) {
        this.game = game;
        this.draggedPiece = null;
        this.draggedIndex = -1;
        this.isDragging = false;
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        // Anchor point: the center of the piece, always follows cursor/finger
        this.anchorPointX = 0;
        this.anchorPointY = 0;
    }

    /**
     * Setup drag and drop event listeners
     */
    setupDragEvents() {
        const area = document.getElementById('pieces-area');
        
        area.addEventListener('mousedown', (e) => this.onStart(e));
        area.addEventListener('touchstart', (e) => this.onStart(e), {passive: false});

        document.addEventListener('mousemove', (e) => this.onMove(e));
        document.addEventListener('touchmove', (e) => this.onMove(e), {passive: false});

        document.addEventListener('mouseup', (e) => this.onEnd(e));
        document.addEventListener('touchend', (e) => this.onEnd(e));
        document.addEventListener('touchcancel', (e) => this.onCancel(e)); // Handle touch cancellation
    }

    /**
     * Handle drag start
     */
    onStart(e) {
        const target = e.target.closest('.piece');
        if (!target) return;
        
        // Prevent default behaviors
        e.preventDefault();
        e.stopPropagation();

        this.draggedIndex = parseInt(target.dataset.index);
        const pieceData = this.game.currentPieces[this.draggedIndex];
        if (!pieceData) return;

        this.draggedPiece = pieceData;
        this.isDragging = true;

        // Get pointer position
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // Project initial position onto board so ghost piece appears on board immediately
        const projected = this.projectToBoard(clientX, clientY);
        this.anchorPointX = projected.x;
        this.anchorPointY = projected.y;

        // Hide original piece with better visual feedback
        target.style.opacity = '0.3';
        target.style.transform = 'scale(0.95)';
        
        // Prevent body scroll on mobile
        if (this.isMobile) {
            document.body.style.overflow = 'hidden';
        }
        
        // Initial render with ghost piece
        this.game.renderBoard();
    }

    /**
     * Handle drag move
     */
    onMove(e) {
        if (!this.isDragging || !this.draggedPiece) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        this.updateGhostPosition(clientX, clientY);
        
        // Highlight preview (uses anchor point)
        this.game.highlightPreview(this.anchorPointX, this.anchorPointY, this.draggedPiece);
    }

    /**
     * Handle drag end
     */
    async onEnd(e) {
        if (!this.isDragging || !this.draggedPiece) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // Use anchor point for placement
        const placed = await this.game.tryPlacePiece(this.anchorPointX, this.anchorPointY, this.draggedPiece);
        
        // Clean up dragging state FIRST (before renderBoard to hide ghost)
        this.isDragging = false;
        const tempDraggedPiece = this.draggedPiece;
        this.draggedPiece = null;
        
        // Restore body scroll
        if (this.isMobile) {
            document.body.style.overflow = '';
        }
        
        const originalPieceEl = this.game.slots[this.draggedIndex]?.querySelector('.piece');
        if (placed) {
            // Remove from current pieces
            this.game.currentPieces[this.draggedIndex] = null;
            this.game.slots[this.draggedIndex].innerHTML = '';
            
            // Clear highlight and render (ghost piece will be gone because isDragging = false)
            this.game.clearHighlight();
            
            // Check if all pieces are used
            if (this.game.currentPieces.every(p => p === null)) {
                this.game.spawnNewPieces();
            } else {
                this.game.checkGameOver();
            }
        } else {
            // Return to original position
            if (originalPieceEl) {
                originalPieceEl.style.opacity = '1';
                originalPieceEl.style.transform = '';
            }
            // Clear highlight and render (ghost piece will be gone because isDragging = false)
            this.game.clearHighlight();
        }

        this.draggedIndex = -1;
    }

    /**
     * Handle touch cancellation (e.g., incoming call, notification)
     */
    onCancel(e) {
        if (!this.isDragging) return;
        
        // Clean up same as onEnd
        this.isDragging = false;
        
        // Restore body scroll
        if (this.isMobile) {
            document.body.style.overflow = '';
        }
        
        const originalPieceEl = this.game.slots[this.draggedIndex]?.querySelector('.piece');
        if (originalPieceEl) {
            originalPieceEl.style.opacity = '1';
            originalPieceEl.style.transform = '';
        }
        this.game.clearHighlight();

        this.draggedPiece = null;
        this.draggedIndex = -1;
    }

    /**
     * Project screen coordinates onto board area
     * This ensures ghost piece always appears on board, even if cursor is below
     * Uses valid zone (board + pieces area) and clamps to board bounds
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     * @returns {Object} - {x, y} coordinates projected onto board
     */
    projectToBoard(screenX, screenY) {
        const boardRect = this.game.renderer.canvas.getBoundingClientRect();
        const piecesArea = document.getElementById('pieces-area');
        const piecesRect = piecesArea.getBoundingClientRect();
        
        // Define valid zone: board + pieces area + small margin for smooth transition
        const margin = 50;
        const validZone = {
            left: Math.min(boardRect.left, piecesRect.left) - margin,
            right: Math.max(boardRect.right, piecesRect.right) + margin,
            top: boardRect.top - margin,
            bottom: piecesRect.bottom + margin
        };
        
        let projectedX = screenX;
        let projectedY = screenY;
        
        // Check if cursor is in valid zone
        const inValidZone = screenX >= validZone.left && screenX <= validZone.right &&
                           screenY >= validZone.top && screenY <= validZone.bottom;
        
        if (inValidZone) {
            // Cursor is in valid zone - project smoothly
            
            // X coordinate: map from valid zone to board
            if (screenX >= boardRect.left && screenX <= boardRect.right) {
                // Directly in board - use actual position
                projectedX = screenX;
            } else if (screenX >= piecesRect.left && screenX <= piecesRect.right) {
                // In pieces area - map proportionally to board
                const relativeX = (screenX - piecesRect.left) / piecesRect.width;
                projectedX = boardRect.left + relativeX * boardRect.width;
            } else {
                // Between areas - clamp to nearest board edge
                if (screenX < boardRect.left) {
                    projectedX = boardRect.left;
                } else {
                    projectedX = boardRect.right;
                }
            }
            
            // Y coordinate: map from valid zone to board
            if (screenY >= boardRect.top && screenY <= boardRect.bottom) {
                // Directly in board - use actual position
                projectedY = screenY;
            } else if (screenY >= piecesRect.top && screenY <= piecesRect.bottom) {
                // In pieces area - map proportionally to board
                const relativeY = (screenY - piecesRect.top) / piecesRect.height;
                projectedY = boardRect.top + relativeY * boardRect.height;
            } else if (screenY < boardRect.top) {
                // Above board - clamp to top
                projectedY = boardRect.top;
            } else {
                // Below pieces area - clamp to bottom
                projectedY = boardRect.bottom;
            }
        } else {
            // Cursor is outside valid zone - clamp to nearest board edge
            // This prevents ghost piece from jumping to center
            projectedX = Math.max(boardRect.left, Math.min(boardRect.right, screenX));
            projectedY = Math.max(boardRect.top, Math.min(boardRect.bottom, screenY));
        }
        
        // Final clamp: ensure anchor point is always strictly within board bounds
        // This is the safety net to prevent any edge cases
        projectedX = Math.max(boardRect.left, Math.min(boardRect.right, projectedX));
        projectedY = Math.max(boardRect.top, Math.min(boardRect.bottom, projectedY));
        
        return { x: projectedX, y: projectedY };
    }

    /**
     * Update anchor point position
     * Anchor point (center of piece) always follows cursor/finger position
     * Ghost piece appears on board immediately and moves synchronously
     * @param {number} x - Screen X coordinate (cursor/finger position)
     * @param {number} y - Screen Y coordinate (cursor/finger position)
     */
    updateGhostPosition(x, y) {
        // Project cursor position onto board area
        // This ensures ghost piece appears on board even if cursor is below
        const projected = this.projectToBoard(x, y);
        
        // Anchor point follows the projected position
        this.anchorPointX = projected.x;
        this.anchorPointY = projected.y;
        
        // Trigger board redraw to show ghost piece
        this.game.renderBoard();
    }
}

