import { Grid } from './grid.js';

(async () => {
  const canvas = document.querySelector('canvas');

  if (!navigator.gpu) {
    console.log('WebGPU is not supported in this browser.');
    throw new Error('WebGPU is not supported in this browser.');
  } else {
    console.log('WebGPU is supported in this browser.');
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('No suitable GPU adapter found.');

  const device = await adapter.requestDevice();

  const context = canvas.getContext('webgpu');
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device: device,
    format: canvasFormat,
  })

  const vertices = new Float32Array([
//   X,    Y,
    -0.8, -0.8, // Triangle 1 (Blue)
    0.8, -0.8,
    0.8, 0.8,

    -0.8, -0.8, // Triangle 2 (Red)
    0.8, 0.8,
    -0.8, 0.8,
  ]);

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
        format: canvasFormat
      }]
    }
  });

  // Create grid instance
  const GRID_WIDTH = 10;
  const GRID_HEIGHT = 20;
  const grid = new Grid(GRID_WIDTH, GRID_HEIGHT);
  const TOTAL_CELLS = grid.totalCells;

  // Create a uniform buffer that describes the grid.
  const uniformArray = new Float32Array([grid.getWidth(), grid.getHeight()]);
  const uniformBuffer = device.createBuffer({
    label: "Grid Uniforms",
    size: uniformArray.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

  // Create storage buffer for cell colors (RGBA per cell)
  const cellColors = grid.getCellColors();
  const cellColorsBuffer = device.createBuffer({
    label: "Cell Colors",
    size: cellColors.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(cellColorsBuffer, 0, cellColors);

  const bindGroup = device.createBindGroup({
    label: "Cell renderer bind group",
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

  // Function to render a frame
  function render() {
    // Update grid color buffer
    device.queue.writeBuffer(cellColorsBuffer, 0, grid.getCellColors());

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
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
  });

  // Initial render
  render();

  setInterval(() => {
    grid.update();
    render();
  }, 1000/10);
})();
