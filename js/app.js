import {Grid} from './grid.js';
import {Renderer, vertices} from './renderer.js';

// Create grid instance
const GRID_WIDTH = 10;
const GRID_HEIGHT = 20;
const grid = new Grid(GRID_WIDTH, GRID_HEIGHT);
const TOTAL_CELLS = grid.totalCells;

// Hold canvas setup (4x4 preview grid)
const HOLD_PREVIEW_SIZE = 4;
const HOLD_TOTAL_CELLS = HOLD_PREVIEW_SIZE * HOLD_PREVIEW_SIZE;

function createBuffersAndBindGroup(renderer, uniformArray, cellColors, canvas, labels) {
  const context = canvas.getContext('webgpu');
  context.configure({
    device: renderer.device,
    format: navigator.gpu.getPreferredCanvasFormat(),
  });

  const uniformBuffer = renderer.device.createBuffer({
    label: labels.uniform,
    size: uniformArray.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  renderer.device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

  const cellColorsBuffer = renderer.device.createBuffer({
    label: labels.cellColors,
    size: cellColors.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  renderer.device.queue.writeBuffer(cellColorsBuffer, 0, cellColors);

  const bindGroup = renderer.device.createBindGroup({
    label: labels.bindGroup,
    layout: renderer.renderPipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {buffer: uniformBuffer}
      },
      {
        binding: 1,
        resource: {buffer: cellColorsBuffer}
      }
    ],
  });

  return {
    context,
    cellColorsBuffer,
    bindGroup,
  };
}

function createMainBuffersAndBindGroup(renderer) {
  const canvas = document.querySelector('#main-canvas');
  const uniformArray = new Float32Array([grid.getWidth(), grid.getHeight()]);
  const cellColors = grid.getCellColors();
  return createBuffersAndBindGroup(
    renderer,
    uniformArray,
    cellColors,
    canvas,
    {
      uniform: "Grid Uniforms",
      cellColors: "Cell Colors",
      bindGroup: "Cell renderer bind group"
    }
  );
}

function createHoldBuffersAndBindGroup(renderer) {
  const holdCanvas = document.querySelector('#hold-canvas');
  const uniformArray = new Float32Array([HOLD_PREVIEW_SIZE, HOLD_PREVIEW_SIZE]);
  const cellColors = grid.getHeldTetrominoColors();
  return createBuffersAndBindGroup(
    renderer,
    uniformArray,
    cellColors,
    holdCanvas,
    {
      uniform: "Hold Grid Uniforms",
      cellColors: "Hold Cell Colors",
      bindGroup: "Hold cell renderer bind group"
    }
  );
}

(async () => {
  const renderer = new Renderer();
  await renderer.initialize();

  const {context, cellColorsBuffer, bindGroup} = createMainBuffersAndBindGroup(renderer);
  const {context: holdContext, cellColorsBuffer: holdCellColorsBuffer, bindGroup: holdBindGroup} = createHoldBuffersAndBindGroup(renderer);

  // Function to render a frame
  function render() {
    renderer.device.queue.writeBuffer(cellColorsBuffer, 0, grid.getCellColors());
    const encoder = renderer.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        clearValue: {r: 0.6, g: 0.6, b: 0.6, a: 1.0},
        storeOp: 'store',
      }]
    });

    pass.setPipeline(renderer.renderPipeline);
    pass.setVertexBuffer(0, renderer.vertexBuffer);
    pass.setBindGroup(0, bindGroup);
    pass.draw(vertices.length / 2, TOTAL_CELLS);

    pass.end();
    renderer.device.queue.submit([encoder.finish()]);
  }

  // Function to render hold canvas (only when held tetromino changes)
  function renderHold() {
    renderer.device.queue.writeBuffer(holdCellColorsBuffer, 0, grid.getHeldTetrominoColors());
    const encoder = renderer.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: holdContext.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
      }]
    });

    pass.setPipeline(renderer.renderPipeline);
    pass.setVertexBuffer(0, renderer.vertexBuffer);
    pass.setBindGroup(0, holdBindGroup);
    pass.draw(vertices.length / 2, HOLD_TOTAL_CELLS);

    pass.end();
    renderer.device.queue.submit([encoder.finish()]);
  }

  // Add keyboard event listeners for arrow keys
  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (grid.moveLeft()) {
        render();
      }
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (grid.moveRight()) {
        render();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (grid.moveDown()) {
        render();
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (grid.rotateClockwise()) {
        render();
      }
      return;
    }

    if (event.key === 'x' || event.key === 'X') {
      event.preventDefault();
      if (grid.rotateClockwise()) {
        render();
      }
      return;
    }

    if (event.key === 'z' || event.key === 'Z') {
      event.preventDefault();
      if (grid.rotateCounterClockwise()) {
        render();
      }
      return;
    }

    if (event.key === ' ') {
      event.preventDefault();
      if (grid.hardDrop()) {
        render();
      }
      return;
    }

    if (event.key === 'c' || event.key === 'C') {
      event.preventDefault();
      if (grid.holdTetromino()) {
        render();
        renderHold(); // Update hold canvas when holding
      }
      return;
    }
  });

  // Set up stats UI update callback
  const levelCounter = document.querySelector('#level-counter');
  const linesCounter = document.querySelector('#lines-counter');
  const scoreCounter = document.querySelector('#score-counter');

  function updateStatsDisplay() {
    if (levelCounter) {
      levelCounter.textContent = grid.getLevel();
    }
    if (linesCounter) {
      linesCounter.textContent = grid.getLinesCleared();
    }
    if (scoreCounter) {
      scoreCounter.textContent = grid.getScore();
    }
  }

  // Set the update callback on stats
  grid.getStats().setUpdateCallback(updateStatsDisplay);

  // Initial render
  grid.spawnTetromino();
  render();
  renderHold(); // Initial hold canvas render

  setInterval(() => {
    grid.update();
    render();
  }, 1000 / 10);
})();
