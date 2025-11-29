export class Stats {
  constructor() {
    // Lines cleared counter
    this.linesCleared = 0;

    // Score counter
    this.score = 0;

    // Scoring points for line clears (classic Tetris scoring)
    this.SCORE_SINGLE = 100;
    this.SCORE_DOUBLE = 300;
    this.SCORE_TRIPLE = 500;
    this.SCORE_TETRIS = 800;

    // UI update callback
    this.onUpdate = null;
  }

  // Calculate base points based on number of lines cleared (without level multiplier)
  calculateBasePoints(linesCleared) {
    switch (linesCleared) {
      case 1:
        return this.SCORE_SINGLE;
      case 2:
        return this.SCORE_DOUBLE;
      case 3:
        return this.SCORE_TRIPLE;
      case 4:
        return this.SCORE_TETRIS;
      default:
        // For more than 4 lines (shouldn't happen in normal Tetris, but handle it)
        return linesCleared * 200;
    }
  }

  // Calculate points based on number of lines cleared and current level
  calculatePoints(linesCleared) {
    const basePoints = this.calculateBasePoints(linesCleared);
    return basePoints * this.getLevel();
  }

  // Add cleared lines and update score
  addLinesCleared(count) {
    if (count <= 0) {
      return;
    }

    const pointsEarned = this.calculatePoints(count);
    this.linesCleared += count;
    this.score += pointsEarned;

    // Trigger UI update callback if set
    if (this.onUpdate) {
      this.onUpdate();
    }
  }

  // Get lines cleared count
  getLinesCleared() {
    return this.linesCleared;
  }

  // Get current score
  getScore() {
    return this.score;
  }

  // Get current level (1 + floor(linesCleared/10))
  getLevel() {
    return 1 + Math.floor(this.linesCleared / 10);
  }

  // Reset all stats
  reset() {
    this.linesCleared = 0;
    this.score = 0;
    if (this.onUpdate) {
      this.onUpdate();
    }
  }

  // Set callback for UI updates
  setUpdateCallback(callback) {
    this.onUpdate = callback;
  }
}

