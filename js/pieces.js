/**
 * PIECE GENERATOR
 * Handles piece generation, rotation, and validation
 */
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

    /**
     * Generate n pieces using the piece generation algorithm
     * @param {number} nPieces - Number of pieces to generate
     * @param {Array} currentBoardState - Current board state
     * @returns {Array} - Array of piece objects
     */
    generatePieces(nPieces, currentBoardState) {
        let result = [];
        // Clone board for simulation (tempBoard)
        let tempBoard = currentBoardState.map(row => [...row]);
        
        // Loop nPieces times
        for (let i = 0; i < nPieces; i++) {
            let foundPiece = null;
            let attempts = 0;

            while (!foundPiece && attempts < MAX_GENERATION_ATTEMPTS) {
                // Step 1: Get random shape from library
                let randomShape = this.getWeightedRandomShape();
                
                // Try all 4 rotations: 0, 90, 180, 270
                let rotations = this.getAllRotations(randomShape);
                
                // Shuffle rotations for randomness
                rotations.sort(() => Math.random() - 0.5);

                for (let shapeVariant of rotations) {
                    // Step 1 (continued): Try to place on tempBoard
                    let placement = this.boardManager.findValidPosition(tempBoard, shapeVariant);
                    
                    if (placement) {
                        // Step 2: Found valid placement -> Select this piece
                        foundPiece = {
                            matrix: shapeVariant,
                            color: COLORS[Math.floor(Math.random() * COLORS.length)],
                            id: Date.now() + Math.random()
                        };
                        
                        // Step 3: Update tempBoard (place piece and clear lines)
                        this.boardManager.simulatePlaceAndClear(tempBoard, foundPiece.matrix, placement.r, placement.c);
                        break; 
                    }
                }
                attempts++;
            }

            // Fallback: If unlucky and couldn't find any valid piece (board too full),
            // just pick a random one (so game can end if truly no moves left)
            if (!foundPiece) {
                let randomShape = this.getWeightedRandomShape();
                foundPiece = {
                    matrix: randomShape,
                    color: COLORS[Math.floor(Math.random() * COLORS.length)],
                    id: Date.now() + Math.random()
                };
            }

            result.push(foundPiece);
        }
        return result;
    }

    /**
     * Rotate matrix 90 degrees clockwise
     * @param {Array} matrix - 2D array to rotate
     * @returns {Array} - Rotated matrix
     */
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

    /**
     * Get all 4 rotations of a piece (0, 90, 180, 270 degrees)
     * Removes duplicates for symmetric shapes
     * @param {Array} matrix - Original piece matrix
     * @returns {Array} - Array of unique rotated matrices
     */
    getAllRotations(matrix) {
        let rotations = [];
        let curr = matrix;
        // 4 directions: 0, 90, 180, 270
        for (let i = 0; i < 4; i++) {
            // Check if rotation already exists (for symmetric shapes like square)
            let str = JSON.stringify(curr);
            if (!rotations.some(m => JSON.stringify(m) === str)) {
                rotations.push(curr);
            }
            curr = this.rotateMatrix(curr);
        }
        return rotations;
    }
}

