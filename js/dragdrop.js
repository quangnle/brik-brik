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

        // Get pointer position (this will be our anchor point)
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // Set anchor point: center of the piece, positioned at cursor/finger
        this.anchorPointX = clientX;
        this.anchorPointY = clientY;

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
     * Update anchor point position
     * Anchor point (center of piece) always follows cursor/finger position
     * @param {number} x - Screen X coordinate (anchor point position)
     * @param {number} y - Screen Y coordinate (anchor point position)
     */
    updateGhostPosition(x, y) {
        // Anchor point is the center of the piece
        this.anchorPointX = x;
        this.anchorPointY = y;
        // Trigger board redraw to show ghost piece
        this.game.renderBoard();
    }
}

