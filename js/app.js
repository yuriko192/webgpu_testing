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


  const GRID_SIZE = 50;
  const TOP_ROW = GRID_SIZE - 1;
  const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

  // Create a uniform buffer that describes the grid.
  const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);
  const uniformBuffer = device.createBuffer({
    label: "Grid Uniforms",
    size: uniformArray.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

  // Create storage buffer for cell colors (RGBA per cell)
  // Initialize all cells to gray
  const cellColors = new Float32Array(TOTAL_CELLS * 4); // 4 floats per color (RGBA)
  for (let i = 0; i < TOTAL_CELLS; i++) {
    cellColors[i * 4 + 0] = 0.5; // R
    cellColors[i * 4 + 1] = 0.5; // G
    cellColors[i * 4 + 2] = 0.5; // B
    cellColors[i * 4 + 3] = 1.0; // A
  }

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
    device.queue.writeBuffer(cellColorsBuffer, 0, cellColors);

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

  // Helper function to check if a cell is colored (not gray)
  function isColored(cellIndex) {
    const r = cellColors[cellIndex * 4 + 0];
    const g = cellColors[cellIndex * 4 + 1];
    const b = cellColors[cellIndex * 4 + 2];
    // Check if color is not gray (allowing for small floating point differences)
    return !(Math.abs(r - 0.5) < 0.01 && Math.abs(g - 0.5) < 0.01 && Math.abs(b - 0.5) < 0.01);
  }

  // Helper function to get cell index from row and column
  function getCellIndex(row, col) {
    return row * GRID_SIZE + col;
  }

  // Helper function to get row and column from cell index
  function getRowCol(cellIndex) {
    return {
      row: Math.floor(cellIndex / GRID_SIZE),
      col: cellIndex % GRID_SIZE
    };
  }

  // Helper function to set a cell to gray
  function setCellGray(cellIndex) {
    cellColors[cellIndex * 4 + 0] = 0.5;
    cellColors[cellIndex * 4 + 1] = 0.5;
    cellColors[cellIndex * 4 + 2] = 0.5;
    cellColors[cellIndex * 4 + 3] = 1.0;
  }

  // Helper function to copy color from one cell to another
  function copyCellColor(fromIndex, toIndex) {
    cellColors[toIndex * 4 + 0] = cellColors[fromIndex * 4 + 0];
    cellColors[toIndex * 4 + 1] = cellColors[fromIndex * 4 + 1];
    cellColors[toIndex * 4 + 2] = cellColors[fromIndex * 4 + 2];
    cellColors[toIndex * 4 + 3] = cellColors[fromIndex * 4 + 3];
  }

  // Helper function to check if a row is completely filled
  function isRowFilled(row) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cellIndex = getCellIndex(row, col);
      if (!isColored(cellIndex)) {
        return false;
      }
    }
    return true;
  }

  // Helper function to clear a specific row (set all cells in row to gray)
  function clearRow(row) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cellIndex = getCellIndex(row, col);
      setCellGray(cellIndex);
    }
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

  function applyGravity() {
    for (let row = 1; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const cellIdx = getCellIndex(row, col);
        if(! isColored(cellIdx)) continue;

        const cellBelowIdx = getCellIndex(row - 1, col);
        if (isColored(cellBelowIdx)) continue;

        copyCellColor(cellIdx, cellBelowIdx);
        setCellGray(cellIdx);
      }
    }
  }

  function colorRandomCell() {
    const randomCol = Math.floor(Math.random() * GRID_SIZE);
    const newCellIndex = getCellIndex(TOP_ROW, randomCol);

    // Only add if the cell is gray (not already colored)
    if (!isColored(newCellIndex)) {
      const color = getRandomColor();
      cellColors[newCellIndex * 4 + 0] = color[0];
      cellColors[newCellIndex * 4 + 1] = color[1];
      cellColors[newCellIndex * 4 + 2] = color[2];
      cellColors[newCellIndex * 4 + 3] = color[3];
    }
  }

  // Function to clear completed rows starting from the bottom and continuing upward
  function clearCompletedRows() {
    for (let row = 0; row < GRID_SIZE; row++) {
      if (!isRowFilled(row)) break;

      clearRow(row);
    }
  }

  function updateGrid() {
    clearCompletedRows();
    applyGravity();
    colorRandomCell();
  }

  // Initial render
  render();

  setInterval(() => {
    updateGrid();
    render();
  }, 1000/60);
})();
