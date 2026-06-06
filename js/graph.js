class Graph {
  constructor() {
    this.nodes = new Map();
    this.adjacencyList = new Map();
  }

  addNode(node) {
    this.nodes.set(node.id, node);
    this.adjacencyList.set(node.id, []);
  }

  addEdge(edge) {
    this.adjacencyList.get(edge.from).push({
      to: edge.to,
      weight: edge.distance,
      accessible: edge.accessible
    });
  }
}

const graph = new Graph();