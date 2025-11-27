export class Grid {
  constructor(size = 50) {
    this.size = size;
    this.topRow = size - 1;
    this.totalCells = size * size;
    
    // Initialize all cells to gray
    this.cellColors = new Float32Array(this.totalCells * 4); // 4 floats per color (RGBA)
    for (let i = 0; i < this.totalCells; i++) {
      this.cellColors[i * 4 + 0] = 0.5; // R
      this.cellColors[i * 4 + 1] = 0.5; // G
      this.cellColors[i * 4 + 2] = 0.5; // B
      this.cellColors[i * 4 + 3] = 1.0; // A
    }
  }

  // Helper function to get cell index from row and column
  getCellIndex(row, col) {
    return row * this.size + col;
  }

  // Helper function to get row and column from cell index
  getRowCol(cellIndex) {
    return {
      row: Math.floor(cellIndex / this.size),
      col: cellIndex % this.size
    };
  }

  // Helper function to check if a cell is colored (not gray)
  isColored(cellIndex) {
    const r = this.cellColors[cellIndex * 4 + 0];
    const g = this.cellColors[cellIndex * 4 + 1];
    const b = this.cellColors[cellIndex * 4 + 2];
    // Check if color is not gray (allowing for small floating point differences)
    return !(Math.abs(r - 0.5) < 0.01 && Math.abs(g - 0.5) < 0.01 && Math.abs(b - 0.5) < 0.01);
  }

  // Helper function to set a cell to gray
  setCellGray(cellIndex) {
    this.cellColors[cellIndex * 4 + 0] = 0.5;
    this.cellColors[cellIndex * 4 + 1] = 0.5;
    this.cellColors[cellIndex * 4 + 2] = 0.5;
    this.cellColors[cellIndex * 4 + 3] = 1.0;
  }

  // Helper function to copy color from one cell to another
  copyCellColor(fromIndex, toIndex) {
    this.cellColors[toIndex * 4 + 0] = this.cellColors[fromIndex * 4 + 0];
    this.cellColors[toIndex * 4 + 1] = this.cellColors[fromIndex * 4 + 1];
    this.cellColors[toIndex * 4 + 2] = this.cellColors[fromIndex * 4 + 2];
    this.cellColors[toIndex * 4 + 3] = this.cellColors[fromIndex * 4 + 3];
  }

  // Helper function to check if a row is completely filled
  isRowFilled(row) {
    for (let col = 0; col < this.size; col++) {
      const cellIndex = this.getCellIndex(row, col);
      if (!this.isColored(cellIndex)) {
        return false;
      }
    }
    return true;
  }

  // Helper function to clear a specific row (set all cells in row to gray)
  clearRow(row) {
    for (let col = 0; col < this.size; col++) {
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

  // Apply gravity to make colored cells fall
  applyGravity() {
    for (let row = 1; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const cellIdx = this.getCellIndex(row, col);
        if (!this.isColored(cellIdx)) continue;

        const cellBelowIdx = this.getCellIndex(row - 1, col);
        if (this.isColored(cellBelowIdx)) continue;

        this.copyCellColor(cellIdx, cellBelowIdx);
        this.setCellGray(cellIdx);
      }
    }
  }

  // Color a random cell at the top row
  colorRandomCell() {
    const randomCol = Math.floor(Math.random() * this.size);
    const newCellIndex = this.getCellIndex(this.topRow, randomCol);

    // Only add if the cell is gray (not already colored)
    if (!this.isColored(newCellIndex)) {
      const color = this.getRandomColor();
      this.cellColors[newCellIndex * 4 + 0] = color[0];
      this.cellColors[newCellIndex * 4 + 1] = color[1];
      this.cellColors[newCellIndex * 4 + 2] = color[2];
      this.cellColors[newCellIndex * 4 + 3] = color[3];
    }
  }

  // Function to clear completed rows starting from the bottom and continuing upward
  clearCompletedRows() {
    for (let row = 0; row < this.size; row++) {
      if (!this.isRowFilled(row)) break;

      this.clearRow(row);
    }
  }

  // Main update function that applies all game logic
  update() {
    this.clearCompletedRows();
    this.applyGravity();
    this.colorRandomCell();
  }

  // Get the cell colors array (for WebGPU buffer updates)
  getCellColors() {
    return this.cellColors;
  }

  // Get grid size (for uniform buffer)
  getSize() {
    return this.size;
  }
}

