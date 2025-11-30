import {Grid} from './grid.js';

// Create grid instance
const GRID_WIDTH = 10;
const GRID_HEIGHT = 20;
const grid = new Grid(GRID_WIDTH, GRID_HEIGHT);
const TOTAL_CELLS = grid.totalCells;

// Hold canvas setup (4x4 preview grid)
const HOLD_PREVIEW_SIZE = 4;
const HOLD_TOTAL_CELLS = HOLD_PREVIEW_SIZE * HOLD_PREVIEW_SIZE;

// Vertices for rendering a cell (2 triangles per cell)
// Cell have inner padding of 20%
const vertices = new Float32Array([
//   X,    Y,
  -0.8, -0.8, // Triangle 1 (Blue)
  0.8, -0.8,
  0.8, 0.8,

  -0.8, -0.8, // Triangle 2 (Red)
  0.8, 0.8,
  -0.8, 0.8,
]);

function createBuffersAndBindGroup(device, cellPipeline, uniformArray, cellColors, canvas, labels) {
  const context = canvas.getContext('webgpu');
  context.configure({
    device: device,
    format: navigator.gpu.getPreferredCanvasFormat(),
  });

  const uniformBuffer = device.createBuffer({
    label: labels.uniform,
    size: uniformArray.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

  const cellColorsBuffer = device.createBuffer({
    label: labels.cellColors,
    size: cellColors.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(cellColorsBuffer, 0, cellColors);

  const bindGroup = device.createBindGroup({
    label: labels.bindGroup,
    layout: cellPipeline.getBindGroupLayout(0),
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

function createMainBuffersAndBindGroup(device, cellPipeline,) {
  const canvas = document.querySelector('#main-canvas');
  const uniformArray = new Float32Array([grid.getWidth(), grid.getHeight()]);
  const cellColors = grid.getCellColors();
  return createBuffersAndBindGroup(
    device,
    cellPipeline,
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

function createHoldBuffersAndBindGroup(device, cellPipeline) {
  const holdCanvas = document.querySelector('#hold-canvas');
  const uniformArray = new Float32Array([HOLD_PREVIEW_SIZE, HOLD_PREVIEW_SIZE]);
  const cellColors = grid.getHeldTetrominoColors();
  return createBuffersAndBindGroup(
    device,
    cellPipeline,
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

async function initializeRendering() {

  if (!navigator.gpu) {
    console.log('WebGPU is not supported in this browser.');
    throw new Error('WebGPU is not supported in this browser.');
  } else {
    console.log('WebGPU is supported in this browser.');
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('No suitable GPU adapter found.');

  const device = await adapter.requestDevice();


  const vertexBuffer = device.createBuffer({
    label: 'cell vertices',
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertices);

  const vertexBufferLayout = {
    arrayStride: 8,
    attributes: [
      {
        format: 'float32x2',
        offset: 0,
        shaderLocation: 0,
      },
    ],
  }

  // Load shader code from external file
  const shaderResponse = await fetch('/shaders/cell.wgsl');
  const shaderCode = await shaderResponse.text();

  const cellShaderModule = device.createShaderModule({
    label: "Cell shader",
    code: shaderCode,
  })

  const cellPipeline = device.createRenderPipeline({
    label: "Cell pipeline",
    layout: "auto",
    vertex: {
      module: cellShaderModule,
      entryPoint: "vertexMain",
      buffers: [vertexBufferLayout]
    },
    fragment: {
      module: cellShaderModule,
      entryPoint: "fragmentMain",
      targets: [{
        format: navigator.gpu.getPreferredCanvasFormat()
      }]
    }
  });

  const {context, cellColorsBuffer, bindGroup} =
    createMainBuffersAndBindGroup(device, cellPipeline);
  const {context: holdContext, cellColorsBuffer: holdCellColorsBuffer, bindGroup: holdBindGroup} =
    createHoldBuffersAndBindGroup(device, cellPipeline);

  return {
    device,
    vertexBuffer,
    cellPipeline,

    context,
    cellColorsBuffer,
    bindGroup,

    holdContext,
    holdCellColorsBuffer,
    holdBindGroup,
  };
}

(async () => {
  const {
    device,
    vertexBuffer,
    cellPipeline,

    context,
    cellColorsBuffer,
    bindGroup,

    holdContext,
    holdCellColorsBuffer,
    holdBindGroup,
  } = await initializeRendering();

  // Function to render a frame
  function render() {
    device.queue.writeBuffer(cellColorsBuffer, 0, grid.getCellColors());
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        clearValue: {r: 0.6, g: 0.6, b: 0.6, a: 1.0},
        storeOp: 'store',
      }]
    });

    pass.setPipeline(cellPipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setBindGroup(0, bindGroup);
    pass.draw(vertices.length / 2, TOTAL_CELLS);

    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  // Function to render hold canvas (only when held tetromino changes)
  function renderHold() {
    device.queue.writeBuffer(holdCellColorsBuffer, 0, grid.getHeldTetrominoColors());
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: holdContext.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
      }]
    });

    pass.setPipeline(cellPipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setBindGroup(0, holdBindGroup);
    pass.draw(vertices.length / 2, HOLD_TOTAL_CELLS);

    pass.end();
    device.queue.submit([encoder.finish()]);
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
