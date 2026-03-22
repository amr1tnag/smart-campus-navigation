import json
import math

# =========================
# Distance utilities
# =========================
def haversine_distance(coord1, coord2):
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    R = 6371000  # meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# =========================
# Load GeoJSON
# =========================
with open("data/data.geojson", "r", encoding="utf-8") as f:
    geo = json.load(f)

nodes = {}
edges = []
node_id = 1

path_node_ids = set()
poi_node_ids = set()

NODE_SNAP = 1.5      # meters (merge duplicate nodes)
POI_CONNECT = 150    # meters (POI → path)
PATH_SNAP = 5        # meters (path continuity)

# =========================
# Helpers
# =========================
def find_existing_node(lat, lon):
    for n in nodes.values():
        if haversine_distance((lat, lon), (n["lat"], n["lng"])) <= NODE_SNAP:
            return n["id"]
    return None

def find_nearest_path_node(lat, lon):
    best = None
    best_dist = float("inf")
    for pid in path_node_ids:
        p = nodes[pid]
        d = haversine_distance((lat, lon), (p["lat"], p["lng"]))
        if d < best_dist:
            best_dist = d
            best = pid
    return best, best_dist


# =========================
# 1️⃣ Build PATH network
# =========================
for feature in geo["features"]:
    if feature["geometry"]["type"] != "LineString":
        continue

    coords = feature["geometry"]["coordinates"]
    seq = []

    for lon, lat in coords:
        existing = find_existing_node(lat, lon)
        if existing:
            nid = existing
        else:
            nid = node_id
            nodes[nid] = {
                "id": nid,
                "name": "",
                "lat": lat,
                "lng": lon,
                "type": "path",
                "accessible": True
            }
            path_node_ids.add(nid)
            node_id += 1
        seq.append(nid)

    for i in range(len(seq) - 1):
        a, b = seq[i], seq[i + 1]
        d = haversine_distance(
            (nodes[a]["lat"], nodes[a]["lng"]),
            (nodes[b]["lat"], nodes[b]["lng"])
        )
        edges.append({
            "from": a,
            "to": b,
            "distance": d,
            "time": d / 1.4,
            "accessible": True
        })
        edges.append({
            "from": b,
            "to": a,
            "distance": d,
            "time": d / 1.4,
            "accessible": True
        })


# =========================
# 2️⃣ Snap PATH breaks
# =========================
path_list = list(path_node_ids)

for i in range(len(path_list)):
    for j in range(i + 1, len(path_list)):
        a = nodes[path_list[i]]
        b = nodes[path_list[j]]

        d = haversine_distance(
            (a["lat"], a["lng"]),
            (b["lat"], b["lng"])
        )

        if d <= PATH_SNAP:
            edges.append({
                "from": a["id"],
                "to": b["id"],
                "distance": d,
                "time": d / 1.4,
                "accessible": True
            })
            edges.append({
                "from": b["id"],
                "to": a["id"],
                "distance": d,
                "time": d / 1.4,
                "accessible": True
            })


# =========================
# 3️⃣ Add POIs (Points)
# =========================
for feature in geo["features"]:
    if feature["geometry"]["type"] != "Point":
        continue

    lon, lat = feature["geometry"]["coordinates"]
    name = feature.get("properties", {}).get("name", "")

    nid = node_id
    nodes[nid] = {
        "id": nid,
        "name": name,
        "lat": lat,
        "lng": lon,
        "type": "poi",
        "accessible": True
    }
    poi_node_ids.add(nid)
    node_id += 1

    nearest, dist = find_nearest_path_node(lat, lon)

    if nearest and dist <= POI_CONNECT:
        edges.append({
            "from": nid,
            "to": nearest,
            "distance": dist,
            "time": dist / 1.4,
            "accessible": True
        })
        edges.append({
            "from": nearest,
            "to": nid,
            "distance": dist,
            "time": dist / 1.4,
            "accessible": True
        })


# =========================
# Save Output
# =========================
output = {
    "nodes": list(nodes.values()),
    "edges": edges
}

with open("campus_nodes_edges.json", "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2)

print("✅ D.Y. Patil campus graph generated successfully")
print(f"Nodes: {len(nodes)} | Edges: {len(edges)}")
