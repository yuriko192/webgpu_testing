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


  const GRID_SIZE = 20;
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

  // Function to generate a random color
  function getRandomColor() {
    return [
      Math.random(), // R
      Math.random(), // G
      Math.random(), // B
      1.0            // A
    ];
  }

  // Function to update a random cell with a random color
  function updateRandomCell() {
    const randomCellIndex = Math.floor(Math.random() * TOTAL_CELLS);
    const color = getRandomColor();
    
    // Update the color in the array
    cellColors[randomCellIndex * 4 + 0] = color[0];
    cellColors[randomCellIndex * 4 + 1] = color[1];
    cellColors[randomCellIndex * 4 + 2] = color[2];
    cellColors[randomCellIndex * 4 + 3] = color[3];
    
    // Write the entire updated array to the buffer
    device.queue.writeBuffer(cellColorsBuffer, 0, cellColors);
  }

  // Initial render
  render();

  // Update a random cell every 200ms
  setInterval(() => {
    updateRandomCell();
    render();
  }, 200);
})();
