struct VertexInput {
  @location(0) pos: vec2f,
  @builtin(instance_index) instance: u32,
};

struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(0) cellIdx: vec2f, // New line!
};

@group(0) @binding(0) var<uniform> grid: vec2f;

// Check if a cell is in the center plus shape (horizontal and vertical center lines)
fn IsHighlighted(cellIndex: vec2f) -> bool {
  let centerX = grid.x / 2.0;
  let centerY = grid.y / 2.0;
  // Check if cell is on the horizontal center line (y = centerY) or vertical center line (x = centerX)
  // For even-sized grids, include both center rows/columns
  let isOnVerticalLine = abs(cellIndex.x - centerX) < 1.0;
  let isOnHorizontalLine = abs(cellIndex.y - centerY) < 1.0;
  return isOnVerticalLine || isOnHorizontalLine;
}

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
  let isInPlus = IsHighlighted(input.cellIdx);

  if (!isInPlus) {
    return vec4f(cellIdx, 1-cellIdx.x, 1); // (Red, Green, Blue, Alpha)
  } else {
    return vec4f(0.5, 0.5, 0.5, 1); // Gray
  }
}

