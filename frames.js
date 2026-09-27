// frames.js：路径前缀与栈深
export function pathsOf(stack) {
  const frames = Array.isArray(stack) ? stack : [];
  const paths = [];
  let prefix = "";
  for (const frame of frames) {
    prefix = prefix === "" ? String(frame) : prefix + "/" + String(frame);
    paths.push(prefix);
  }
  return paths;
}

export function depthOf(stack) {
  return Array.isArray(stack) ? stack.length : 0;
}
