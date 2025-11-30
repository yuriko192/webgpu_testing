import {Tetromino, TETROMINOES} from './tetromino.js';
import {Stats} from './stats.js';

const STATE_ORDER = ['0', 'R', '2', 'L'];


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
  constructor(width = 10, height = 20, previewGridSize = 4, lockDelayMs = 500,) {
    this.width = width;
    this.height = height;
    this.topRow = height - 1;
    this.totalCells = width * height;
    this.previewGridSize = previewGridSize;

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

    // Current falling tetromino: {
    //      tetromino: Tetromino class,
    //      centerRow,
    //      centerCol,
    //      rotatedPositions
    // }
    this.currentTetromino = null;

    // currently Held tetromino
    this.heldTetromino = null;
    this.canHold = true; // Flag to prevent holding multiple times per spawn

    // Shadow cells for harddrop preview
    this.shadowCells = new Set(); // Set of cell indices that are shadow cells

    // Lock delay timer
    // delay before a non-moving tetromino is committed
    this.lockDelayMs = lockDelayMs;
    this.lockDelayStartTime = null; // Timestamp when lock delay started

    // Stats tracker
    this.stats = new Stats();

    // Random bag system for tetromino generation
    this.tetrominoBag = [];
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

  // Refill the tetromino bag with all 7 pieces and shuffle
  refillBag() {
    const shapes = Object.keys(TETROMINOES);
    this.tetrominoBag = [...shapes];

    // Fisher-Yates shuffle algorithm
    for (let i = this.tetrominoBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tetrominoBag[i], this.tetrominoBag[j]] = [this.tetrominoBag[j], this.tetrominoBag[i]];
    }
  }

  // Get a random tetromino instance using 7 bag system
  getRandomTetromino() {
    if (this.tetrominoBag.length === 0) {
      this.refillBag();
    }

    // Pop the last element from the bag
    const shape = this.tetrominoBag.pop();
    return TETROMINOES[shape];
  }

  // Get absolute positions of a tetromino at a given center position
  getTetrominoPositions({tetromino, centerRow, centerCol, rotatedPositions = null}) {
    const relativePositions = rotatedPositions || tetromino.cellPositions;
    return relativePositions.map(([dr, dc]) => ({
      row: centerRow + dr,
      col: centerCol + dc
    }));
  }

  // Check if a tetromino can be placed at a position
  // {tetromino, centerRow, centerCol, rotatedPositions = null}
  canPlaceTetromino(tetrominoState) {
    const newPosition = this.getTetrominoPositions(tetrominoState);

    for (const {row, col} of newPosition) {
      // Use isValidPosition to check bounds and if cell is already colored
      if (!this.isValidPosition(row, col)) {
        return false;
      }
    }
    return true;
  }

  // Place a tetromino on the grid
  // {tetromino, centerRow, centerCol, rotatedPositions = null}
  placeTetromino(tetrominoState) {
    const {tetromino} = tetrominoState;
    const positions = this.getTetrominoPositions(tetrominoState);
    for (const {row, col} of positions) {
      const cellIndex = this.getCellIndex(row, col);
      this.cellColors[cellIndex * 4 + 0] = tetromino.color[0];
      this.cellColors[cellIndex * 4 + 1] = tetromino.color[1];
      this.cellColors[cellIndex * 4 + 2] = tetromino.color[2];
      this.cellColors[cellIndex * 4 + 3] = tetromino.color[3];
      this.isCellColored[cellIndex] = true;
    }
  }

  // Remove a tetromino from the grid
  // {tetromino, centerRow, centerCol, rotatedPositions = null}
  removeTetromino(tetrominoState) {
    const positions = this.getTetrominoPositions(tetrominoState);
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

    this.placeTetromino(this.currentTetromino);
    this.clearShadow();
    this.currentTetromino = null;
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
    const {centerRow} = this.currentTetromino;
    const newCenterRow = centerRow - 1;

    // Check if tetromino can move down (exclude current position from collision check)
    if (this.canPlaceTetromino({...this.currentTetromino, centerRow: newCenterRow})) {
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

    const tetromino = this.getRandomTetromino();
    const centerCol = Math.floor(this.width / 2); // Center horizontally
    const centerRow = this.topRow; // Start at the top
    if (!this.canPlaceTetromino({tetromino, centerRow, centerCol})) {
      return;
    }

    this.currentTetromino = {
      tetromino,
      centerRow,
      centerCol,
      rotatedPositions: null,
      rotationState: '0' // Initialize rotation state to spawn (0)
    };
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
    const tempTetromino = this.currentTetromino.tetromino;

    if (this.heldTetromino) {
      // Swap: put held tetromino as current
      const centerCol = Math.floor(this.width / 2);
      const centerRow = this.topRow;
      if (!this.canPlaceTetromino({tetromino: this.heldTetromino, centerRow, centerCol})) {
        return false;
      }

      this.currentTetromino = {
        tetromino: this.heldTetromino,
        centerRow,
        centerCol,
        rotatedPositions: null,
        rotationState: '0' // Reset rotation state to spawn (0)
      };
      this.lockDelayStartTime = null;
      this.updateShadow();
    } else {
      // No held piece, just spawn a new one
      this.currentTetromino = null;
      this.spawnTetromino();
    }

    // Store the previously current tetromino in hold and update flag
    this.heldTetromino = tempTetromino;
    this.canHold = false;
    return true;
  }

  // Clear filled rows and shifting unfilled rows down
  clearCompletedRows() {
    // sliding window implementation
    let writeRow = 0;
    let readRow = 0;
    let clearedCount = 0;

    // sliding per row, from bottom to top
    for (readRow; readRow < this.height; readRow++) {
      const coloredCellCount = this.getColoredCellCountInRow(readRow);
      if (coloredCellCount === 0) {
        break;
      }

      if (coloredCellCount === this.width) {
        clearedCount++;
        continue;
      }

      // Shift unfilled rows down
      this.copyRow(readRow, writeRow);
      writeRow++;
    }

    // Clear rows from writeRow to readRow (clamp readRow to valid range)
    const endRow = Math.min(readRow, this.height - 1);
    this.clearRows(writeRow, endRow);
    this.stats.addLinesCleared(clearedCount);
  }

  // Main update function that applies all game logic
  update() {
    this.applyGravity();
  }

  // Returns the center offset for the held tetromino in the preview grid
  getHoldTetriminoCenter() {
    if (!this.heldTetromino) {
      return new Float32Array([0.0, 0.0]);
    }

    // Calculate offset needed to center the tetromino in the grid
    const [tetrominoCenterRow, tetrominoCenterCol] = this.heldTetromino.center;
    const gridCenter = (this.previewGridSize - 1) / 2;
    const offsetRow = gridCenter - tetrominoCenterRow;
    const offsetCol = gridCenter - tetrominoCenterCol;

    return new Float32Array([offsetCol, offsetRow]);
  }

  // Returns colors array for a small preview grid showing the held tetromino
  getHeldTetrominoColors() {
    const totalCells = this.previewGridSize * this.previewGridSize;
    const colors = new Float32Array(totalCells * 4); // 4 floats per color (RGBA)

    // Initialize all cells to dark gray/black #191919
    for (let i = 0; i < totalCells; i++) {
      colors[i * 4 + 0] = 0.0; // R
      colors[i * 4 + 1] = 0.0; // G
      colors[i * 4 + 2] = 0.0; // B
      colors[i * 4 + 3] = 0.0; // A
    }

    if (!this.heldTetromino) {
      return colors;
    }

    const relativePositions = this.heldTetromino.cellPositions;

    // Render tetromino starting from bottom-left (0, 0)
    // Offset by 1 to offset negative Tetromino relative positions
    const startRow = 1;
    const startCol = 1;

    for (const [dr, dc] of relativePositions) {
      const row = startRow + dr;
      const col = startCol + dc;

      // Check bounds
      if (row >= 0 && row < this.previewGridSize && col >= 0 && col < this.previewGridSize) {
        const cellIndex = row * this.previewGridSize + col;
        const colorIndex = cellIndex * 4;
        colors[colorIndex + 0] = this.heldTetromino.color[0]; // R
        colors[colorIndex + 1] = this.heldTetromino.color[1]; // G
        colors[colorIndex + 2] = this.heldTetromino.color[2]; // B
        colors[colorIndex + 3] = this.heldTetromino.color[3]; // A
      }
    }

    return colors;
  }

  // Get the grid colors array (for WebGPU buffer updates)
  // Returns colors with shadow cells and active tetromino rendered as pseudo elements
  getCellColors() {
    const colors = new Float32Array(this.cellColors);

    // Render active tetromino cells
    if (this.currentTetromino) {
      const {tetromino} = this.currentTetromino;
      // Apply shadow
      for (const cellIndex of this.shadowCells) {
        const colorIndex = cellIndex * 4;
        // Use semi-transparent version of the tetromino color
        colors[colorIndex + 0] = tetromino.color[0] * 0.3; // R
        colors[colorIndex + 1] = tetromino.color[1] * 0.3; // G
        colors[colorIndex + 2] = tetromino.color[2] * 0.3; // B
        colors[colorIndex + 3] = 0.5; // A (semi-transparent)
      }

      const positions = this.getTetrominoPositions(this.currentTetromino);

      // apply active tetromino cells
      for (const {row, col} of positions) {
        const cellIndex = this.getCellIndex(row, col);
        if (cellIndex >= 0 && cellIndex < this.totalCells) {
          const colorIndex = cellIndex * 4;
          colors[colorIndex + 0] = tetromino.color[0]; // R
          colors[colorIndex + 1] = tetromino.color[1]; // G
          colors[colorIndex + 2] = tetromino.color[2]; // B
          colors[colorIndex + 3] = tetromino.color[3]; // A
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

  // Get lines cleared count
  getLinesCleared() {
    return this.stats.getLinesCleared();
  }

  // Get current score
  getScore() {
    return this.stats.getScore();
  }

  // Get current level
  getLevel() {
    return this.stats.getLevel();
  }

  // Get stats instance
  getStats() {
    return this.stats;
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

    const {centerCol} = this.currentTetromino;
    const newCenterCol = centerCol + direction;
    if (!this.canPlaceTetromino({...this.currentTetromino, centerCol: newCenterCol})) {
      return false;
    }

    this.lockDelayStartTime = null;
    this.currentTetromino.centerCol = newCenterCol;
    this.updateShadow();
    return true;
  }

  // Soft drop current tetromino
  softDrop() {
    if (!this.currentTetromino) {
      return false;
    }

    const {centerRow} = this.currentTetromino;
    const newCenterRow = centerRow - 1;
    if (!this.canPlaceTetromino({...this.currentTetromino, centerRow: newCenterRow})) {
      return false;
    }

    this.lockDelayStartTime = null;
    this.currentTetromino.centerRow = newCenterRow;
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

  // Move falling block down
  moveDown() {
    return this.softDrop();
  }

  // Get rotation state transition
  getRotationTransition(fromState, clockwise) {
    const currentIndex = STATE_ORDER.indexOf(fromState);
    if (clockwise) {
      const nextIndex = (currentIndex + 1) % 4;
      return STATE_ORDER[nextIndex];
    } else {
      const nextIndex = (currentIndex - 1 + 4) % 4;
      return STATE_ORDER[nextIndex];
    }
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

  // Rotate current tetromino with SRS wall kicks
  rotate(clockwise = true) {
    if (!this.currentTetromino) {
      return false;
    }

    const {tetromino} = this.currentTetromino;
    if (tetromino.shape === 'O') {
      return false;
    }

    const kickTable = Tetromino.getKickTable(tetromino.shape);
    if (!kickTable) {
      return false;
    }

    const currentState = this.currentTetromino.rotationState || '0';
    const nextState = this.getRotationTransition(currentState, clockwise);

    // Get the kick offsets for this transition
    const transitionKey = `${currentState}${nextState}`;
    const kickOffsets = kickTable[transitionKey];
    if (!kickOffsets) {
      return false;
    }

    // Try each kick offset
    const currentPositions = this.currentTetromino.rotatedPositions || tetromino.cellPositions;
    const rotatedPositions = this.rotateRelativePosition(currentPositions, clockwise);
    for (const [rowOffset, colOffset] of kickOffsets) {
      const newCenterRow = this.currentTetromino.centerRow + rowOffset;
      const newCenterCol = this.currentTetromino.centerCol + colOffset;

      const testState = {
        ...this.currentTetromino,
        centerRow: newCenterRow,
        centerCol: newCenterCol,
        rotatedPositions: rotatedPositions
      };

      if (this.canPlaceTetromino(testState)) {
        // Success! Apply the rotation with this kick offset
        this.lockDelayStartTime = null;
        this.currentTetromino.centerRow = newCenterRow;
        this.currentTetromino.centerCol = newCenterCol;
        this.currentTetromino.rotatedPositions = rotatedPositions;
        this.currentTetromino.rotationState = nextState;
        this.updateShadow();
        return true;
      }
    }

    // All kick attempts failed
    return false;
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

    // Find the lowest valid position by moving down until we can't
    const {centerRow} = this.currentTetromino;
    let newCenterRow = centerRow;
    while (this.canPlaceTetromino({...this.currentTetromino, centerRow: newCenterRow - 1})) {
      newCenterRow--;
    }

    return {
      ...this.currentTetromino,
      centerRow: newCenterRow
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
    const shadowPositions = this.getTetrominoPositions(hardDropPos);
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

    // Find the lowest valid position by moving down until we can't
    const {centerRow} = this.currentTetromino;
    let newCenterRow = centerRow;
    while (this.canPlaceTetromino({...this.currentTetromino, centerRow: newCenterRow - 1})) {
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

