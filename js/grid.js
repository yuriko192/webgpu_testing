// Tetromino definitions (relative positions from center)
const TETROMINOES = {
  I: [[0, -1], [0, 0], [0, 1], [0, 2]],  // I Shape
  O: [[-1, 0], [-1, 1], [0, 0], [0, 1]], // Square
  T: [[-1, 0], [0, -1], [0, 0], [0, 1]],  // T shape
  S: [[-1, 0], [-1, 1], [0, -1], [0, 0]], // S shape
  Z: [[-1, -1], [-1, 0], [0, 0], [0, 1]], // Z shape
  J: [[-1, -1], [0, -1], [0, 0], [0, 1]], // J shape
  L: [[-1, 1], [0, -1], [0, 0], [0, 1]]   // L shape
};

// Standard Tetris color constants (RGBA)
const TETROMINO_COLORS = {
  I: [0.0, 1.0, 1.0, 1.0],   // Cyan
  O: [1.0, 1.0, 0.0, 1.0],   // Yellow
  T: [1.0, 0.0, 1.0, 1.0],   // Magenta/Purple
  S: [0.0, 1.0, 0.0, 1.0],   // Green
  Z: [1.0, 0.0, 0.0, 1.0],   // Red
  J: [0.0, 0.0, 1.0, 1.0],   // Blue
  L: [1.0, 0.647, 0.0, 1.0]  // Orange
};

// Function to get standard Tetris color for a tetromino shape
// Default to gray if shape not found
function getTetrominoColor(shape) {
  return TETROMINO_COLORS[shape] || [0.5, 0.5, 0.5, 1.0];
}

// Function to generate a random color
function getRandomColor() {
  return [
    Math.random(), // R
    Math.random(), // G
    Math.random(), // B
    1.0            // A
  ];
}

export class Grid {
  constructor(width = 10, height = 20, lockDelayMs = 200) {
    this.width = width;
    this.height = height;
    this.topRow = height - 1;
    this.totalCells = width * height;

    // Initialize all cells to gray
    this.cellColors = new Float32Array(this.totalCells * 4); // 4 floats per color (RGBA)
    // Boolean array to track if a cell is colored
    this.isCellColored = new Array(this.totalCells).fill(false);

    for (let i = 0; i < this.totalCells; i++) {
      this.cellColors[i * 4 + 0] = 0.5; // R
      this.cellColors[i * 4 + 1] = 0.5; // G
      this.cellColors[i * 4 + 2] = 0.5; // B
      this.cellColors[i * 4 + 3] = 1.0; // A
    }

    // Current falling tetromino
    this.currentTetromino = null;
    this.currentTetrominoColor = null;

    // Lock delay timer
    // delay before a non-moving tetromino is committed
    this.lockDelayMs = lockDelayMs;
    this.lockDelayStartTime = null; // Timestamp when lock delay started
  }

  // Helper function to get cell index from row and column
  getCellIndex(row, col) {
    return row * this.width + col;
  }

  // Helper function to get row and column from cell index
  getRowCol(cellIndex) {
    return {
      row: Math.floor(cellIndex / this.width),
      col: cellIndex % this.width
    };
  }

  // Helper function to check if a cell is colored (not gray)
  isColored(cellIndex) {
    return this.isCellColored[cellIndex];
  }

  // Helper function to set a cell to gray
  setCellGray(cellIndex) {
    this.cellColors[cellIndex * 4 + 0] = 0.5;
    this.cellColors[cellIndex * 4 + 1] = 0.5;
    this.cellColors[cellIndex * 4 + 2] = 0.5;
    this.cellColors[cellIndex * 4 + 3] = 1.0;
    this.isCellColored[cellIndex] = false;
  }

  // Helper function to copy color from one cell to another
  copyCellColor(fromIndex, toIndex) {
    this.cellColors[toIndex * 4 + 0] = this.cellColors[fromIndex * 4 + 0];
    this.cellColors[toIndex * 4 + 1] = this.cellColors[fromIndex * 4 + 1];
    this.cellColors[toIndex * 4 + 2] = this.cellColors[fromIndex * 4 + 2];
    this.cellColors[toIndex * 4 + 3] = this.cellColors[fromIndex * 4 + 3];
    this.isCellColored[toIndex] = this.isCellColored[fromIndex];
  }

  // Helper function to check if a row is completely filled
  isRowFilled(row) {
    for (let col = 0; col < this.width; col++) {
      const cellIndex = this.getCellIndex(row, col);
      if (!this.isColored(cellIndex)) {
        return false;
      }
    }
    return true;
  }

  // Helper function to clear a specific row (set all cells in row to gray)
  clearRow(row) {
    for (let col = 0; col < this.width; col++) {
      const cellIndex = this.getCellIndex(row, col);
      this.setCellGray(cellIndex);
    }
  }


  // Get a random tetromino shape
  getRandomTetromino() {
    const shapes = Object.keys(TETROMINOES);
    return shapes[Math.floor(Math.random() * shapes.length)];
  }

  // Get absolute positions of a tetromino at a given center position
  getTetrominoPositions(shape, centerRow, centerCol, rotatedPositions = null) {
    const relativePositions = rotatedPositions || TETROMINOES[shape];
    return relativePositions.map(([dr, dc]) => ({
      row: centerRow + dr,
      col: centerCol + dc
    }));
  }

  // Check if a tetromino can be placed at a position
  canPlaceTetromino(shape, centerRow, centerCol, rotatedPositions = null) {
    const newPosition = this.getTetrominoPositions(shape, centerRow, centerCol, rotatedPositions);
    const currentPositions = this.currentTetromino
      ? this.getTetrominoPositions(
        this.currentTetromino.shape,
        this.currentTetromino.centerRow,
        this.currentTetromino.centerCol,
        this.currentTetromino.rotatedPositions
      )
      : [];

    for (const {row, col} of newPosition) {
      const isCurrentPosition = currentPositions.some(p => p.row === row && p.col === col);
      if (isCurrentPosition) {
        continue;
      }

      // Use isValidPosition to check bounds and if cell is already colored
      if (!this.isValidPosition(row, col)) {
        return false;
      }
    }
    return true;
  }

  // Place a tetromino on the grid
  placeTetromino(shape, centerRow, centerCol, color, rotatedPositions = null) {
    const positions = this.getTetrominoPositions(shape, centerRow, centerCol, rotatedPositions);
    for (const {row, col} of positions) {
      const cellIndex = this.getCellIndex(row, col);
      this.cellColors[cellIndex * 4 + 0] = color[0];
      this.cellColors[cellIndex * 4 + 1] = color[1];
      this.cellColors[cellIndex * 4 + 2] = color[2];
      this.cellColors[cellIndex * 4 + 3] = color[3];
      this.isCellColored[cellIndex] = true;
    }
  }

  // Remove a tetromino from the grid
  removeTetromino(shape, centerRow, centerCol, rotatedPositions = null) {
    const positions = this.getTetrominoPositions(shape, centerRow, centerCol, rotatedPositions);
    for (const {row, col} of positions) {
      const cellIndex = this.getCellIndex(row, col);
      this.setCellGray(cellIndex);
    }
  }

  // Apply gravity to every cell. unlinked from a tetromino state.
  // Considered end of game
  applyEndGravity() {
    for (let row = 1; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        const cellIdx = this.getCellIndex(row, col);
        if (!this.isColored(cellIdx)) continue;

        const cellBelowIdx = this.getCellIndex(row - 1, col);
        if (this.isColored(cellBelowIdx)) continue;

        this.copyCellColor(cellIdx, cellBelowIdx);
        this.setCellGray(cellIdx);
      }
    }
  }

  // Apply gravity to the current falling tetromino
  applyGravity() {
    if (!this.currentTetromino) {
      // No active tetromino, apply end game gravity logic
      this.applyEndGravity();
      return;
    }

    // Move the current tetromino down
    const {shape, centerRow, centerCol} = this.currentTetromino;
    const rotatedPositions = this.currentTetromino.rotatedPositions || null;
    const newCenterRow = centerRow - 1;

    // Check if tetromino can move down (exclude current position from collision check)
    if (this.canPlaceTetromino(shape, newCenterRow, centerCol, rotatedPositions)) {
      this.lockDelayStartTime = null;
      this.removeTetromino(shape, centerRow, centerCol, rotatedPositions);
      this.placeTetromino(shape, newCenterRow, centerCol, this.currentTetrominoColor, rotatedPositions);
      this.currentTetromino.centerRow = newCenterRow;
      return;
    }

    const currentTime = Date.now();
    if (this.lockDelayStartTime === null) {
      this.lockDelayStartTime = currentTime;
      return;
    }

    const elapsedTime = currentTime - this.lockDelayStartTime;
    if (elapsedTime >= this.lockDelayMs) {
      // Commit tetromino to grid
      this.currentTetromino = null;
      this.currentTetrominoColor = null;
      this.lockDelayStartTime = null;
    }
  }

  // Spawn a random tetromino at the top of the grid
  // Only spawn if there's no current tetromino
  spawnTetromino() {
    if (this.currentTetromino) {
      return;
    }

    const shape = this.getRandomTetromino();
    const centerCol = Math.floor(this.width / 2); // Center horizontally
    const centerRow = this.topRow; // Start at the top

    if (!this.canPlaceTetromino(shape, centerRow, centerCol)) {
      return;
    }

    const color = getTetrominoColor(shape);
    this.placeTetromino(shape, centerRow, centerCol, color);
    this.currentTetromino = {shape, centerRow, centerCol, rotatedPositions: null};
    this.currentTetrominoColor = color;
    this.lockDelayStartTime = null;
  }

  // Function to clear completed rows starting from the bottom and continuing upward
  clearCompletedRows() {
    for (let row = 0; row < this.height; row++) {
      if (!this.isRowFilled(row)) break;

      this.clearRow(row);
    }
  }

  // Main update function that applies all game logic
  update() {
    this.clearCompletedRows();
    this.applyGravity();
    this.spawnTetromino();
  }

  // Get the grid colors array (for WebGPU buffer updates)
  getCellColors() {
    return this.cellColors;
  }

  // Get grid width (for uniform buffer)
  getWidth() {
    return this.width;
  }

  // Get grid height (for uniform buffer)
  getHeight() {
    return this.height;
  }

  // Get all cells that are currently falling (colored cells that can still fall)
  getFallingCells() {
    const fallingCells = [];
    for (let row = 1; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        const cellIdx = this.getCellIndex(row, col);
        if (!this.isColored(cellIdx)) continue;

        const cellBelowIdx = this.getCellIndex(row - 1, col);
        if (!this.isColored(cellBelowIdx)) {
          fallingCells.push({row, col, cellIndex: cellIdx});
        }
      }
    }

    return fallingCells;
  }

  // Check if a position is valid for movement (within bounds and not colored)
  isValidPosition(row, col) {
    if (col < 0 || col >= this.width
      || row < 0 || row >= this.height) {
      return false;
    }

    const cellIndex = this.getCellIndex(row, col);
    return !this.isColored(cellIndex);
  }

  // Move current tetromino horizontally
  // (direction: -1 for left, 1 for right)
  moveTetromino(direction) {
    if (!this.currentTetromino) {
      return false;
    }

    const {shape, centerRow, centerCol} = this.currentTetromino;
    const rotatedPositions = this.currentTetromino.rotatedPositions || null;
    const newCenterCol = centerCol + direction;

    if (!this.canPlaceTetromino(shape, centerRow, newCenterCol, rotatedPositions)) {
      return false;
    }

    this.lockDelayStartTime = null;
    this.removeTetromino(shape, centerRow, centerCol, rotatedPositions);
    this.placeTetromino(shape, centerRow, newCenterCol, this.currentTetrominoColor, rotatedPositions);
    this.currentTetromino.centerCol = newCenterCol;
    return true;
  }

  // Move falling block left
  moveLeft() {
    return this.moveTetromino(-1);
  }

  // Move falling block right
  moveRight() {
    return this.moveTetromino(1);
  }

  // Rotate a tetromino's relative positions
  rotateRelativePosition(relativePositions, clockwise = true) {
    if (clockwise) {
      // Rotate each position 90 degrees clockwise: [dr, dc] -> [dc, -dr]
      return relativePositions.map(([dr, dc]) => [dc, -dr]);
    } else {
      // Rotate each position 90 degrees counter-clockwise: [dr, dc] -> [-dc, dr]
      return relativePositions.map(([dr, dc]) => [-dc, dr]);
    }
  }

  // Rotate current tetromino
  rotate(clockwise = true) {
    if (!this.currentTetromino) {
      return false;
    }

    const {shape, centerRow, centerCol} = this.currentTetromino;
    const currentPositions = this.currentTetromino.rotatedPositions || TETROMINOES[shape];
    const rotatedPositions = this.rotateRelativePosition(currentPositions, clockwise);

    // Check if rotated tetromino can be placed (excluding current tetromino positions)
    if (!this.canPlaceTetromino(shape, centerRow, centerCol, rotatedPositions)) {
      return false;
    }

    this.lockDelayStartTime = null;
    this.removeTetromino(shape, centerRow, centerCol, currentPositions);
    this.placeTetromino(shape, centerRow, centerCol, this.currentTetrominoColor, rotatedPositions);
    this.currentTetromino.rotatedPositions = rotatedPositions;

    return true;
  }

  // Rotate current tetromino clockwise (convenience method)
  rotateClockwise() {
    return this.rotate(true);
  }

  // Rotate current tetromino counter-clockwise (convenience method)
  rotateCounterClockwise() {
    return this.rotate(false);
  }
}

