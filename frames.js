// frames.js：把栈展开成根到各层的前缀路径，并给出栈深
export function pathsOf(stack) {
  if (!Array.isArray(stack)) return [];
  const paths = [];
  for (let i = 0; i < stack.length; i += 1) {
    paths.push(stack.slice(0, i + 1).join("/"));
  }
  return paths;
}

export function depthOf(stack) {
  return Array.isArray(stack) ? stack.length : 0;
}
