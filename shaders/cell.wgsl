struct VertexInput {
  @location(0) pos: vec2f,
  @builtin(instance_index) instance: u32,
};

struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(0) cellIdx: vec2f, // New line!
};

@group(0) @binding(0) var<uniform> grid: vec2f;
@group(0) @binding(1) var<storage, read> cellColors: array<vec4f>;

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
  let cellX = u32(input.cellIdx.x);
  let cellY = u32(input.cellIdx.y);
  let cellIndex = cellY * u32(grid.x) + cellX;
  return cellColors[cellIndex];
}

