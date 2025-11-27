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

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: 'clear',
      storeOp: 'store',
    }]
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

  const cellShaderModule = device.createShaderModule({
    label: "Cell shader",
    code: /* wgsl */ `
  struct VertexInput {
    @location(0) pos: vec2f,
    @builtin(instance_index) instance: u32,
  };

  struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) cellIdx: vec2f, // New line!
  };

  @group(0) @binding(0) var<uniform> grid: vec2f;

  @vertex
  fn vertexMain(
    input: VertexInput,
  ) -> VertexOutput{
    let i = f32(input.instance);
    let cellIndex = vec2f(i % grid.x, floor(i / grid.x));
    let offset = cellIndex/grid*2;
    let gridPos = (input.pos+1)/grid - 1 + offset;

    var output: VertexOutput;
    output.pos = vec4f(gridPos, 0.0, 1.0);
    output.cellIdx = cellIndex;

    return output;
  }

  @fragment
  fn fragmentMain(input : VertexOutput) -> @location(0) vec4f {
  let cellIdx = input.cellIdx / grid;
   return vec4f(cellIdx, 1-cellIdx.x, 1); // (Red, Green, Blue, Alpha)
  }
  `,
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

// Create a uniform buffer that describes the grid.
  const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);
  const uniformBuffer = device.createBuffer({
    label: "Grid Uniforms",
    size: uniformArray.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

  const bindGroup = device.createBindGroup({
    label: "Cell renderer bind group",
    layout: cellPipeline.getBindGroupLayout(0),
    entries: [{
      binding: 0,
      resource: {buffer: uniformBuffer}
    }],
  });


// After encoder.beginRenderPass()

  pass.setPipeline(cellPipeline);
  pass.setVertexBuffer(0, vertexBuffer);
  pass.setBindGroup(0, bindGroup);

  pass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE); // 6 vertices

  pass.end();
  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
})();
