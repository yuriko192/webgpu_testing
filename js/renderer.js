// Vertices for rendering a cell (2 triangles per cell)
// Cell have inner padding of 20%
export const vertices = new Float32Array([
//   X,    Y,
  -0.8, -0.8, // Triangle 1 (Blue)
  0.8, -0.8,
  0.8, 0.8,

  -0.8, -0.8, // Triangle 2 (Red)
  0.8, 0.8,
  -0.8, 0.8,
]);

export class Renderer {
  constructor() {
    this.device = null;
    this.vertexBuffer = null;
    this.renderPipeline = null;
  }

  async initialize() {
    if (!navigator.gpu) {
      console.log('WebGPU is not supported in this browser.');
      throw new Error('WebGPU is not supported in this browser.');
    } else {
      console.log('WebGPU is supported in this browser.');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No suitable GPU adapter found.');

    this.device = await adapter.requestDevice();

    this.vertexBuffer = this.device.createBuffer({
      label: 'cell vertices',
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

    const vertexBufferLayout = {
      arrayStride: 8,
      attributes: [
        {
          format: 'float32x2',
          offset: 0,
          shaderLocation: 0,
        },
      ],
    };

    // Load shader code from external file
    const shaderResponse = await fetch('/shaders/cell.wgsl');
    const shaderCode = await shaderResponse.text();

    const cellShaderModule = this.device.createShaderModule({
      label: "Cell shader",
      code: shaderCode,
    });

    this.renderPipeline = this.device.createRenderPipeline({
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
  }
}

