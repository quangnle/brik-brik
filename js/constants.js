/**
 * GAME CONSTANTS
 */

// Board configuration
const BOARD_SIZE = 8;
const PIECES_PER_ROUND = 3;
const MAX_GENERATION_ATTEMPTS = 50;

// Piece generation cell size for display
const PIECE_DISPLAY_CELL_SIZE = 20;

// Mobile detection
const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Mobile-specific piece display size (larger for easier touch)
const PIECE_DISPLAY_CELL_SIZE_MOBILE = 24;

// Animation timing
const CLEAR_ANIMATION_DURATION = 300; // milliseconds

// Score calculation
const BASE_POINTS_PER_BLOCK = 1;
const LINE_CLEAR_BASE_POINTS = 10;
const LINE_CLEAR_MULTIPLIER = 2;

// Define all puzzle pieces (1: block, 0: empty)
const RAW_SHAPES = {
    P1: [[1,1,1,1]], // I4
    P2: [[1,1,1]],   // I3
    P3: [[1,1]],     // I2
    P4: [[1]],       // I1
    P5: [[1,0,0], [1,0,0], [1,1,1]], // Large L
    P6: [[1,0], [1,1]], // Small L
    P7: [[1,0], [1,0], [1,1]], // Tall L
    P8: [[0,1,0], [1,1,1]], // T
    P9: [[1,1,0], [0,1,1]], // Z
    P10: [[1,1,1], [1,1,1], [1,1,1]], // 3x3 Square
    P11: [[1,1], [1,1]] // 2x2 Square
};

// Colors for pieces
const COLORS = [
    'bg-cyan-500', 'bg-blue-500', 'bg-orange-500', 'bg-yellow-500', 
    'bg-green-500', 'bg-purple-500', 'bg-red-500', 'bg-pink-500'
];

