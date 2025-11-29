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

// Pre-calculated centers of all tetromino shapes (midpoint between min and max positions)
const TETROMINO_CENTERS = (() => {
  const centers = {};
  for (const [shape,positions] of Object.entries(TETROMINOES)) {
    let minRow = Infinity;
    let maxRow = -Infinity;
    let minCol = Infinity;
    let maxCol = -Infinity;

    for (const [row, col] of positions) {
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
    }

    centers[shape] = [
      (minRow + maxRow) / 2,
      (minCol + maxCol) / 2
    ];
  }
  return centers;
})();

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

// Returns the center as the midpoint between min and max positions in a Tetromino
function getTetrominoCenter(shape) {
  return TETROMINO_CENTERS[shape] || [0, 0];
}

export class Grid {
  constructor(width = 10, height = 20, lockDelayMs = 500) {
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

    // Held tetromino
    this.heldTetromino = null;
    this.heldTetrominoColor = null;
    this.canHold = true; // Flag to prevent holding multiple times per spawn

    // Shadow cells for harddrop preview
    this.shadowCells = new Set(); // Set of cell indices that are shadow cells

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

  // Helper function to get the count of colored cells in a row
  getColoredCellCountInRow(row) {
    let count = 0;
    for (let col = 0; col < this.width; col++) {
      const cellIndex = this.getCellIndex(row, col);
      if (this.isColored(cellIndex)) {
        count++;
      }
    }
    return count;
  }

  // Helper function to clear a specific row (set all cells in row to gray)
  clearRow(row) {
    for (let col = 0; col < this.width; col++) {
      const cellIndex = this.getCellIndex(row, col);
      this.setCellGray(cellIndex);
    }
  }

  // Copy a row from source row to target row
  // Uses two-pointer approach, copying each cell one by one
  copyRow(sourceRow, targetRow) {
    if (sourceRow === targetRow) {
      return
    }

    const floatsPerCell = 4;

    // Copy each cell one by one
    const sourceCellStartIndex = sourceRow * this.width;
    const targetCellStartIndex = targetRow * this.width;
    for (let col = 0; col < this.width; col++) {
      const sourceCellIndex = sourceCellStartIndex + col;
      const targetCellIndex = targetCellStartIndex + col;

      const sourceColorIndex = sourceCellIndex * floatsPerCell;
      const targetColorIndex = targetCellIndex * floatsPerCell;

      // Copy colored state
      this.isCellColored[targetCellIndex] = this.isCellColored[sourceCellIndex];

      // Copy color data (RGBA - 4 floats per cell)
      this.cellColors[targetColorIndex + 0] = this.cellColors[sourceColorIndex + 0];
      this.cellColors[targetColorIndex + 1] = this.cellColors[sourceColorIndex + 1];
      this.cellColors[targetColorIndex + 2] = this.cellColors[sourceColorIndex + 2];
      this.cellColors[targetColorIndex + 3] = this.cellColors[sourceColorIndex + 3];
    }
  }

  // Clear rows from startRow to endRow (inclusive) with empty cells
  clearRows(startRow, endRow = this.height - 1) {
    for (let row = startRow; row <= endRow; row++) {
      const rowStartCellIndex = row * this.width;
      for (let col = 0; col < this.width; col++) {
        const cellIndex = rowStartCellIndex + col;
        this.setCellGray(cellIndex);
      }
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

  // Lock the current tetromino to the grid
  commitTetromino() {
    if (!this.currentTetromino) {
      return;
    }

    const {shape, centerRow, centerCol} = this.currentTetromino;
    const rotatedPositions = this.currentTetromino.rotatedPositions || null;
    this.placeTetromino(shape, centerRow, centerCol, this.currentTetrominoColor, rotatedPositions);

    this.clearShadow();
    this.currentTetromino = null;
    this.currentTetrominoColor = null;
    this.lockDelayStartTime = null;
    this.clearCompletedRows();
    this.spawnTetromino();
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
      this.currentTetromino.centerRow = newCenterRow;
      this.updateShadow();
      return;
    }

    const currentTime = Date.now();
    if (this.lockDelayStartTime === null) {
      this.lockDelayStartTime = currentTime;
      return;
    }

    const elapsedTime = currentTime - this.lockDelayStartTime;
    if (elapsedTime >= this.lockDelayMs) {
      this.commitTetromino();
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
    this.currentTetromino = {shape, centerRow, centerCol, rotatedPositions: null};
    this.currentTetrominoColor = color;
    this.lockDelayStartTime = null;
    this.canHold = true; // Reset hold flag when spawning new tetromino
    this.updateShadow();
  }

  // Hold the current tetromino and swap with held tetromino if one exists
  holdTetromino() {
    if (!this.currentTetromino || !this.canHold) {
      return false;
    }

    this.clearShadow();
    const tempShape = this.currentTetromino.shape;
    const tempColor = this.currentTetrominoColor;

    if (this.heldTetromino) {
      // Swap: put held tetromino as current
      const heldShape = this.heldTetromino;
      const heldColor = this.heldTetrominoColor;

      const centerCol = Math.floor(this.width / 2);
      const centerRow = this.topRow;

      if (!this.canPlaceTetromino(heldShape, centerRow, centerCol)) {
        return false;
      }

      this.currentTetromino = {shape: heldShape, centerRow, centerCol, rotatedPositions: null};
      this.currentTetrominoColor = heldColor;
      this.lockDelayStartTime = null;
      this.updateShadow();
    } else {
      // No held piece, just spawn a new one
      this.currentTetromino = null;
      this.currentTetrominoColor = null;
      this.spawnTetromino();
    }

    // Store the previously current tetromino in hold and update flag
    this.heldTetromino = tempShape;
    this.heldTetrominoColor = tempColor;
    this.canHold = false;
    return true;
  }

  // Clear filled rows and shifting unfilled rows down
  clearCompletedRows() {
    // sliding window implementation
    let writeRow = 0;
    let readRow = 0;

    // sliding per row, from bottom to top
    for (readRow; readRow < this.height; readRow++) {
      const coloredCellCount = this.getColoredCellCountInRow(readRow);
      if (coloredCellCount === 0) {
        break;
      }

      if (coloredCellCount === this.width) {
        continue;
      }

      // Shift unfilled rows down
      this.copyRow(readRow, writeRow);
      writeRow++;
    }

    // Clear rows from writeRow to readRow (clamp readRow to valid range)
    const endRow = Math.min(readRow, this.height - 1);
    this.clearRows(writeRow, endRow);
  }

  // Main update function that applies all game logic
  update() {
    this.applyGravity();
  }

  // Returns colors array for a small preview grid showing the held tetromino
  getHeldTetrominoColors() {
    const PREVIEW_SIZE = 4;
    const totalCells = PREVIEW_SIZE * PREVIEW_SIZE;
    const colors = new Float32Array(totalCells * 4); // 4 floats per color (RGBA)

    // Initialize all cells to dark gray/black #191919
    for (let i = 0; i < totalCells; i++) {
      colors[i * 4 + 0] = 0.1; // R
      colors[i * 4 + 1] = 0.1; // G
      colors[i * 4 + 2] = 0.1; // B
      colors[i * 4 + 3] = 1.0; // A
    }

    if (!this.heldTetromino) {
      return colors;
    }

    const relativePositions = TETROMINOES[this.heldTetromino];

    // Render tetromino starting from bottom-left (0, 0)
    // Offset by 1 to offset negative Tetromino relative positions
    const startRow = 1;
    const startCol = 1;

    for (const [dr, dc] of relativePositions) {
      const row = startRow + dr;
      const col = startCol + dc;

      // Check bounds
      if (row >= 0 && row < PREVIEW_SIZE && col >= 0 && col < PREVIEW_SIZE) {
        const cellIndex = row * PREVIEW_SIZE + col;
        const colorIndex = cellIndex * 4;
        colors[colorIndex + 0] = this.heldTetrominoColor[0]; // R
        colors[colorIndex + 1] = this.heldTetrominoColor[1]; // G
        colors[colorIndex + 2] = this.heldTetrominoColor[2]; // B
        colors[colorIndex + 3] = this.heldTetrominoColor[3]; // A
      }
    }

    return colors;
  }

  // Get the grid colors array (for WebGPU buffer updates)
  // Returns colors with shadow cells and active tetromino rendered as pseudo elements
  getCellColors() {
    const colors = new Float32Array(this.cellColors);

    // Render active tetromino cells
    if (this.currentTetromino && this.currentTetrominoColor) {
      // Apply shadow
      for (const cellIndex of this.shadowCells) {
        const colorIndex = cellIndex * 4;
        // Use semi-transparent version of the tetromino color
        colors[colorIndex + 0] = this.currentTetrominoColor[0] * 0.3; // R
        colors[colorIndex + 1] = this.currentTetrominoColor[1] * 0.3; // G
        colors[colorIndex + 2] = this.currentTetrominoColor[2] * 0.3; // B
        colors[colorIndex + 3] = 0.5; // A (semi-transparent)
      }

      const positions = this.getTetrominoPositions(
        this.currentTetromino.shape,
        this.currentTetromino.centerRow,
        this.currentTetromino.centerCol,
        this.currentTetromino.rotatedPositions
      );

      // apply active tetromino cells
      for (const {row, col} of positions) {
        const cellIndex = this.getCellIndex(row, col);
        if (cellIndex >= 0 && cellIndex < this.totalCells) {
          const colorIndex = cellIndex * 4;
          colors[colorIndex + 0] = this.currentTetrominoColor[0]; // R
          colors[colorIndex + 1] = this.currentTetrominoColor[1]; // G
          colors[colorIndex + 2] = this.currentTetrominoColor[2]; // B
          colors[colorIndex + 3] = this.currentTetrominoColor[3]; // A
        }
      }

    }

    return colors;
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
    this.currentTetromino.centerCol = newCenterCol;
    this.updateShadow();
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
    // Update rotation without committing to grid
    this.currentTetromino.rotatedPositions = rotatedPositions;
    this.updateShadow();

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

  // Calculate the harddrop position (where the piece would land)
  getHardDropPosition() {
    if (!this.currentTetromino) {
      return null;
    }

    const {shape, centerRow, centerCol} = this.currentTetromino;
    const rotatedPositions = this.currentTetromino.rotatedPositions || null;

    // Find the lowest valid position by moving down until we can't
    let newCenterRow = centerRow;
    while (this.canPlaceTetromino(shape, newCenterRow - 1, centerCol, rotatedPositions)) {
      newCenterRow--;
    }

    return {
      shape,
      centerRow: newCenterRow,
      centerCol,
      rotatedPositions
    };
  }

  // Update shadow cells based on current tetromino position
  updateShadow() {
    this.clearShadow();
    if (!this.currentTetromino) {
      return;
    }

    const hardDropPos = this.getHardDropPosition();
    if (!hardDropPos) {
      return;
    }

    // Don't show shadow if it's at the same position as current tetromino
    if (hardDropPos.centerRow === this.currentTetromino.centerRow &&
      hardDropPos.centerCol === this.currentTetromino.centerCol) {
      return;
    }

    // Mark shadow cells (excluding cells that are part of the current tetromino)
    const shadowPositions = this.getTetrominoPositions(
      hardDropPos.shape,
      hardDropPos.centerRow,
      hardDropPos.centerCol,
      hardDropPos.rotatedPositions
    );

    for (const {row, col} of shadowPositions) {
      const cellIndex = this.getCellIndex(row, col);
      this.shadowCells.add(cellIndex);
    }
  }

  // Clear all shadow cells
  clearShadow() {
    this.shadowCells.clear();
  }

  // Check if a cell is a shadow cell
  isShadowCell(cellIndex) {
    return this.shadowCells.has(cellIndex);
  }

  // Drops the current tetromino to the bottom instantly and commit it
  hardDrop() {
    if (!this.currentTetromino) {
      return false;
    }

    const {shape, centerRow, centerCol} = this.currentTetromino;
    const rotatedPositions = this.currentTetromino.rotatedPositions || null;

    // Find the lowest valid position by moving down until we can't
    let newCenterRow = centerRow;
    while (this.canPlaceTetromino(shape, newCenterRow - 1, centerCol, rotatedPositions)) {
      newCenterRow--;
    }

    // Update position without committing to grid
    if (newCenterRow !== centerRow) {
      this.currentTetromino.centerRow = newCenterRow;
    }

    this.clearShadow();
    this.commitTetromino();
    return true;
  }
}

