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
  const dist = {};
  const prev = {};
  const pq = new Set(graph.nodes.keys());

  graph.nodes.forEach((_, node) => dist[node] = Infinity);
  dist[start] = 0;

  while (pq.size) {
    let u = [...pq].reduce((a, b) => dist[a] < dist[b] ? a : b);
    pq.delete(u);

    if (u === end) break;

    for (const edge of graph.adjacencyList.get(u)) {
      const alt = dist[u] + edge.weight;
      if (alt < dist[edge.to]) {
        dist[edge.to] = alt;
        prev[edge.to] = u;
      }
    }
  }

  const path = [];
  let u = end;

  while (u !== undefined) {
    path.unshift(u);
    u = prev[u];
  }

  return path;
}