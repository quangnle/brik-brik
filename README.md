# 8x8 Puzzle Game

A strategic puzzle game where you place tetris-like pieces on an 8x8 board to clear lines and score points.

## 🎮 How to Play

### Objective
Place puzzle pieces on the 8x8 board to fill complete rows or columns. When a row or column is completely filled, it clears and you earn bonus points!

### Gameplay

1. **Getting Pieces**: Each round, you receive 3 randomly generated puzzle pieces at the bottom of the screen.

2. **Placing Pieces**:
   - **Desktop**: Click and drag a piece from the bottom area onto the board
   - **Mobile**: Touch and drag a piece onto the board
   - Pieces can be placed anywhere on the board as long as they don't overlap with existing blocks
   - A green highlight shows where the piece will be placed when you drag it over the board

3. **Scoring**:
   - **Base Points**: You earn 1 point for each block you place
   - **Line Clear Bonus**: When you complete one or more rows/columns, you earn bonus points:
     - Formula: `(number of lines × 10) + 2 × (number of lines) × (number of lines - 1)`
     - Example: Clearing 2 lines = `(2 × 10) + 2 × 2 × 1 = 20 + 4 = 24 points`

4. **New Pieces**: After placing all 3 pieces, a new set of 3 pieces is automatically generated.

5. **Game Over**: The game ends when you cannot place any of the current pieces on the board. Your final score is displayed.

### Controls

- **Reset Button**: Click the "Reset" button in the top-right corner to start a new game at any time.

## 🧩 Piece Types

The game includes 11 different piece types:
- **I-pieces**: Straight lines of 1, 2, 3, or 4 blocks
- **L-pieces**: L-shaped pieces in various sizes
- **T-piece**: T-shaped piece
- **Z-piece**: Zigzag piece
- **Squares**: 2×2 and 3×3 square pieces

Each piece can be rotated in 4 directions (0°, 90°, 180°, 270°) when generated, but you place them as they appear.

## 🎯 Strategy Tips

1. **Plan Ahead**: Try to visualize where pieces will fit before placing them
2. **Clear Lines**: Focus on completing rows or columns to earn bonus points
3. **Space Management**: Don't fill the board too quickly - leave room for larger pieces
4. **Multiple Clears**: Try to set up situations where placing one piece clears multiple lines for maximum points

## 🛠️ Technical Details

### Project Structure
```
brik-brik/
├── index.html          # Main HTML file
├── css/
│   └── style.css      # Game styles
├── js/
│   ├── constants.js    # Game constants and piece definitions
│   ├── board.js        # Board management logic
│   ├── pieces.js       # Piece generation and rotation
│   ├── dragdrop.js     # Drag and drop handling
│   └── game.js         # Main game class
└── README.md           # This file
```

### Features

- **Responsive Design**: Works on both desktop and mobile devices
- **Touch Support**: Full touch gesture support for mobile gameplay
- **Smooth Animations**: Visual feedback when clearing lines
- **Smart Piece Generation**: Algorithm ensures playable pieces are generated
- **Drag & Drop**: Intuitive piece placement with visual preview

### Browser Compatibility

Works on all modern browsers that support:
- ES6 JavaScript
- CSS Grid
- Touch events (for mobile)

## 📝 License

This project is open source and available for personal and educational use.

## 🎨 Credits

Built with:
- [Tailwind CSS](https://tailwindcss.com/) for styling
- Vanilla JavaScript for game logic

Enjoy the game! 🎮

