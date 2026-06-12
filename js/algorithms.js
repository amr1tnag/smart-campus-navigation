class MinHeap {
  constructor() { this.heap = []; }

  push(priority, value) {
    this.heap.push([priority, value]);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  get size() { return this.heap.length; }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent][0] <= this.heap[i][0]) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let min = i, l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.heap[l][0] < this.heap[min][0]) min = l;
      if (r < n && this.heap[r][0] < this.heap[min][0]) min = r;
      if (min === i) break;
      [this.heap[min], this.heap[i]] = [this.heap[i], this.heap[min]];
      i = min;
    }
  }
}

function bfs(graph, start, end) {
  const queue = [[start]];
  const visited = new Set();

  while (queue.length) {
    const path = queue.shift();
    const node = path[path.length - 1];
    if (node === end) return path;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const edge of graph.adjacencyList.get(node)) {
      queue.push([...path, edge.to]);
    }
  }
  return [];
}

function dfs(graph, start, end) {
  const stack = [[start]];
  const visited = new Set();

  while (stack.length) {
    const path = stack.pop();
    const node = path[path.length - 1];
    if (node === end) return path;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const edge of graph.adjacencyList.get(node)) {
      stack.push([...path, edge.to]);
    }
  }
  return [];
}

function dijkstra(graph, start, end) {
  const dist = new Map();
  const prev = new Map();
  const pq = new MinHeap();
  const visited = new Set();

  graph.nodes.forEach((_, id) => dist.set(id, Infinity));
  dist.set(start, 0);
  pq.push(0, start);

  while (pq.size > 0) {
    const [d, u] = pq.pop();
    if (u === end) break;
    if (visited.has(u)) continue;
    visited.add(u);

    for (const edge of (graph.adjacencyList.get(u) || [])) {
      const alt = d + edge.weight;
      if (alt < dist.get(edge.to)) {
        dist.set(edge.to, alt);
        prev.set(edge.to, u);
        pq.push(alt, edge.to);
      }
    }
  }

  const path = [];
  let u = end;
  while (u !== undefined) {
    path.unshift(u);
    u = prev.get(u);
  }

  return path[0] === start ? path : [];
}
