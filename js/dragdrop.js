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
        // Store initial click position in slot for relative mapping
        this.initialSlotRect = null;
        this.initialClickInSlot = { x: 0, y: 0 };
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

        // Store initial slot rect and click position for relative mapping
        const slot = this.game.slots[this.draggedIndex];
        this.initialSlotRect = slot.getBoundingClientRect();
        this.initialClickInSlot = {
            x: clientX - this.initialSlotRect.left,
            y: clientY - this.initialSlotRect.top
        };

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
        this.initialSlotRect = null;
        this.initialClickInSlot = { x: 0, y: 0 };
        
        // Restore body scroll
        if (this.isMobile) {
            document.body.style.overflow = '';
        }
        
        const originalPieceEl = this.game.slots[this.draggedIndex]?.querySelector('.piece');
        if (placed) {
            // Piece placement is handled by tryPlacePiece which updates state and calls renderPieces
            // Don't manually modify slots here as it can conflict with renderPieces
            // The renderPieces call in tryPlacePiece will handle removing the placed piece
            this.game.clearHighlight();
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
        this.initialSlotRect = null;
        this.initialClickInSlot = { x: 0, y: 0 };
    }

    /**
     * Project screen coordinates onto board area using slot-based mapping
     * Each slot maps proportionally to the entire board
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     * @returns {Object} - {x, y} coordinates projected onto board
     */
    projectToBoard(screenX, screenY) {
        const boardRect = this.game.renderer.canvas.getBoundingClientRect();
        const piecesArea = document.getElementById('pieces-area');
        const piecesRect = piecesArea.getBoundingClientRect();
        
        // If cursor is directly on board, use actual position
        if (screenX >= boardRect.left && screenX <= boardRect.right &&
            screenY >= boardRect.top && screenY <= boardRect.bottom) {
            return { x: screenX, y: screenY };
        }
        
        // If we have initial slot info (during drag), use slot-based mapping
        if (this.isDragging && this.initialSlotRect && this.draggedIndex >= 0) {
            // Get current slot rect (may have changed due to resize)
            const slot = this.game.slots[this.draggedIndex];
            const currentSlotRect = slot.getBoundingClientRect();
            
            // Calculate current cursor position relative to slot
            const currentXInSlot = screenX - currentSlotRect.left;
            const currentYInSlot = screenY - currentSlotRect.top;
            
            // Calculate relative position in slot (0-1)
            const relativeX = currentXInSlot / currentSlotRect.width;
            const relativeY = currentYInSlot / currentSlotRect.height;
            
            // Map to board: relative position * board size + board offset
            let projectedX = boardRect.left + relativeX * boardRect.width;
            let projectedY = boardRect.top + relativeY * boardRect.height;
            
            // Clamp to board bounds
            projectedX = Math.max(boardRect.left, Math.min(boardRect.right, projectedX));
            projectedY = Math.max(boardRect.top, Math.min(boardRect.bottom, projectedY));
            
            return { x: projectedX, y: projectedY };
        }
        
        // Fallback: if not dragging or no slot info, use old logic
        // Define valid zone: board + pieces area + small margin
        const margin = 50;
        const validZone = {
            left: Math.min(boardRect.left, piecesRect.left) - margin,
            right: Math.max(boardRect.right, piecesRect.right) + margin,
            top: boardRect.top - margin,
            bottom: piecesRect.bottom + margin
        };
        
        let projectedX = screenX;
        let projectedY = screenY;
        
        const inValidZone = screenX >= validZone.left && screenX <= validZone.right &&
                           screenY >= validZone.top && screenY <= validZone.bottom;
        
        if (inValidZone) {
            // In pieces area - map proportionally to board
            if (screenX >= piecesRect.left && screenX <= piecesRect.right &&
                screenY >= piecesRect.top && screenY <= piecesRect.bottom) {
                const relativeX = (screenX - piecesRect.left) / piecesRect.width;
                const relativeY = (screenY - piecesRect.top) / piecesRect.height;
                projectedX = boardRect.left + relativeX * boardRect.width;
                projectedY = boardRect.top + relativeY * boardRect.height;
            } else {
                // Between areas - clamp to nearest edge
                projectedX = Math.max(boardRect.left, Math.min(boardRect.right, screenX));
                projectedY = Math.max(boardRect.top, Math.min(boardRect.bottom, screenY));
            }
        } else {
            // Outside valid zone - clamp to nearest board edge
            projectedX = Math.max(boardRect.left, Math.min(boardRect.right, screenX));
            projectedY = Math.max(boardRect.top, Math.min(boardRect.bottom, screenY));
        }
        
        // Final clamp
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

