export class Tetromino {
  // Tetromino definitions (relative positions from center)
  static CELL_POSITIONS = {
    I: [[0, -1], [0, 0], [0, 1], [0, 2]],  // I Shape
    O: [[-1, 0], [-1, 1], [0, 0], [0, 1]], // Square
    T: [[-1, 0], [0, -1], [0, 0], [0, 1]],  // T shape
    S: [[-1, 0], [-1, 1], [0, -1], [0, 0]], // S shape
    Z: [[-1, -1], [-1, 0], [0, 0], [0, 1]], // Z shape
    J: [[-1, -1], [0, -1], [0, 0], [0, 1]], // J shape
    L: [[-1, 1], [0, -1], [0, 0], [0, 1]]   // L shape
  };

  // Standard Tetris color constants (RGBA)
  static COLORS = {
    I: [0.0, 1.0, 1.0, 1.0],   // Cyan
    O: [1.0, 1.0, 0.0, 1.0],   // Yellow
    T: [1.0, 0.0, 1.0, 1.0],   // Magenta/Purple
    S: [0.0, 1.0, 0.0, 1.0],   // Green
    Z: [1.0, 0.0, 0.0, 1.0],   // Red
    J: [0.0, 0.0, 1.0, 1.0],   // Blue
    L: [1.0, 0.647, 0.0, 1.0]  // Orange
  };

  // Pre-calculated bounding boxes of all tetromino shapes
  static BOUNDING_BOXES = (() => {
    const boundingBoxes = {};
    for (const [shape, positions] of Object.entries(Tetromino.CELL_POSITIONS)) {
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

      boundingBoxes[shape] = {
        minRow,
        maxRow,
        minCol,
        maxCol,
        width: maxCol - minCol + 1,
        height: maxRow - minRow + 1
      };
    }
    return boundingBoxes;
  })();

  // Pre-calculated centers of all tetromino shapes (midpoint between min and max positions)
  static CENTERS = (() => {
    const centers = {};
    for (const shape of Object.keys(Tetromino.CELL_POSITIONS)) {
      const bbox = Tetromino.BOUNDING_BOXES[shape];
      centers[shape] = [
        (bbox.minRow + bbox.maxRow) / 2,
        (bbox.minCol + bbox.maxCol) / 2
      ];
    }
    return centers;
  })();

  // SRS (Super Rotation System) Kick Tables
  // Format: [fromState][toState] = array of [rowOffset, colOffset] attempts
  // States: 0 = spawn, R = right, 2 = 180, L = left
  static SRS_KICK_TABLES = {
    // Standard pieces (J, L, S, T, Z)
    JLSTZ: {
      '0R': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
      '2R': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
      '0L': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
      '2L': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
      'R0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
      'R2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
      'L2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
      'L0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    },
    // I-piece has different kick table
    I: {
      '0R': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
      '2R': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
      '0L': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
      '2L': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
      'R0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
      'R2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
      'L2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
      'L0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    }
  };

  // Get kick table for a piece shape
  static getKickTable(shape) {
    if (shape === 'I') {
      return Tetromino.SRS_KICK_TABLES.I;
    } else if (shape === 'O') {
      return null; // O-piece doesn't rotate
    } else {
      return Tetromino.SRS_KICK_TABLES.JLSTZ;
    }
  }

  constructor(shape) {
    this.shape = shape;
    this.cellPositions = Tetromino.CELL_POSITIONS[shape];
    this.color = Tetromino.COLORS[shape];
    this.boundingBox = Tetromino.BOUNDING_BOXES[shape];
    this.center = Tetromino.CENTERS[shape];
  }
}

// Pre-calculated instances of all tetromino shapes
export const TETROMINOES = (() => {
  const tetrominoes = {};
  for (const shape of Object.keys(Tetromino.CELL_POSITIONS)) {
    tetrominoes[shape] = new Tetromino(shape);
  }
  return tetrominoes;
})();

