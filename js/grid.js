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

export class Grid {
  constructor(width = 10, height = 20) {
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

  // Function to generate a random color
  getRandomColor() {
    return [
      Math.random(), // R
      Math.random(), // G
      Math.random(), // B
      1.0            // A
    ];
  }

  // Get a random tetromino shape
  getRandomTetromino() {
    const shapes = Object.keys(TETROMINOES);
    return shapes[Math.floor(Math.random() * shapes.length)];
  }

  // Get absolute positions of a tetromino at a given center position
  getTetrominoPositions(shape, centerRow, centerCol) {
    const relativePositions = TETROMINOES[shape];
    return relativePositions.map(([dr, dc]) => ({
      row: centerRow + dr,
      col: centerCol + dc
    }));
  }

  // Check if a tetromino can be placed at a position
  canPlaceTetromino(shape, centerRow, centerCol, excludeCurrentTetromino = false) {
    const positions = this.getTetrominoPositions(shape, centerRow, centerCol);
    const currentPositions = excludeCurrentTetromino && this.currentTetromino
      ? this.getTetrominoPositions(this.currentTetromino.shape, this.currentTetromino.centerRow, this.currentTetromino.centerCol)
      : [];

    for (const { row, col } of positions) {
      // Check if position is part of current tetromino (if excluding)
      if (excludeCurrentTetromino) {
        const isCurrentPosition = currentPositions.some(p => p.row === row && p.col === col);
        if (isCurrentPosition) {
          continue; // This position is part of current tetromino, so it's valid
        }
      }

      // Use isValidPosition to check bounds and if cell is already colored
      if (!this.isValidPosition(row, col)) {
        return false;
      }
    }
    return true;
  }

  // Place a tetromino on the grid
  placeTetromino(shape, centerRow, centerCol, color) {
    const positions = this.getTetrominoPositions(shape, centerRow, centerCol);
    for (const { row, col } of positions) {
      const cellIndex = this.getCellIndex(row, col);
      this.cellColors[cellIndex * 4 + 0] = color[0];
      this.cellColors[cellIndex * 4 + 1] = color[1];
      this.cellColors[cellIndex * 4 + 2] = color[2];
      this.cellColors[cellIndex * 4 + 3] = color[3];
      this.isCellColored[cellIndex] = true;
    }
  }

  // Remove a tetromino from the grid
  removeTetromino(shape, centerRow, centerCol) {
    const positions = this.getTetrominoPositions(shape, centerRow, centerCol);
    for (const { row, col } of positions) {
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
    const { shape, centerRow, centerCol } = this.currentTetromino;
    const newCenterRow = centerRow - 1;

    // Check if tetromino can move down (exclude current position from collision check)
    if (this.canPlaceTetromino(shape, newCenterRow, centerCol, true)) {
      this.removeTetromino(shape, centerRow, centerCol);
      this.placeTetromino(shape, newCenterRow, centerCol, this.currentTetrominoColor);
      this.currentTetromino.centerRow = newCenterRow;
    } else {
      // Tetromino has landed, clear it
      this.currentTetromino = null;
      this.currentTetrominoColor = null;
    }
  }

  // Spawn a random tetromino at the top of the grid
  spawnTetromino() {
    // Only spawn if there's no current tetromino
    if (this.currentTetromino) {
      return;
    }

    const shape = this.getRandomTetromino();
    const centerCol = Math.floor(this.width / 2); // Center horizontally
    const centerRow = this.topRow; // Start at the top

    // Check if we can place it
    if (this.canPlaceTetromino(shape, centerRow, centerCol)) {
      const color = this.getRandomColor();
      this.placeTetromino(shape, centerRow, centerCol, color);
      this.currentTetromino = { shape, centerRow, centerCol };
      this.currentTetrominoColor = color;
    }
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
          fallingCells.push({ row, col, cellIndex: cellIdx });
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

    const { shape, centerRow, centerCol } = this.currentTetromino;
    const newCenterCol = centerCol + direction;

    // Check if tetromino can move (exclude current position from collision check)
    if (this.canPlaceTetromino(shape, centerRow, newCenterCol, true)) {
      // Remove from old position
      this.removeTetromino(shape, centerRow, centerCol);
      // Place at new position
      this.placeTetromino(shape, centerRow, newCenterCol, this.currentTetrominoColor);
      // Update position
      this.currentTetromino.centerCol = newCenterCol;
      return true;
    }

    return false;
  }

  // Move falling block left
  moveLeft() {
    return this.moveTetromino(-1);
  }

  // Move falling block right
  moveRight() {
    return this.moveTetromino(1);
  }
}

