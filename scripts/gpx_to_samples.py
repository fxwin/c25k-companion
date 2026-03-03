#!/usr/bin/env python3
"""Convert GPX route files into sample workout JS data for C25K app.

Usage:
    python3 scripts/gpx_to_samples.py <gpx_file> <segment_spec> [<segment_spec> ...]

Each segment_spec is: type:start-end
    e.g. warmup:0-57 jog:57-112 walk:112-170

Speeds used (m/s): warmup=1.4, walk=1.5, jog=2.8
Timestamps are minute-offsets from the start of the workout.

Example:
    python3 scripts/gpx_to_samples.py scripts/onthegomap-8-km-route.gpx \
        warmup:0-57 jog:57-112 walk:112-170 jog:170-280 walk:280-384
"""

import sys
import math
import xml.etree.ElementTree as ET


SPEEDS = {'warmup': 1.4, 'walk': 1.5, 'jog': 2.8}


def parse_gpx(path):
    tree = ET.parse(path)
    ns = {'g': 'http://www.topografix.com/GPX/1/1'}
    pts = []
    for pt in tree.findall('.//g:trkpt', ns):
        pts.append((float(pt.get('lat')), float(pt.get('lon'))))
    return pts


def haversine(a, b):
    R = 6371000
    lat1, lat2 = math.radians(a[0]), math.radians(b[0])
    dlat = math.radians(b[0] - a[0])
    dlng = math.radians(b[1] - a[1])
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * R * math.asin(min(1, math.sqrt(h)))


def parse_segment_spec(spec):
    """Parse 'type:start-end' into (type, start_idx, end_idx)."""
    stype, rng = spec.split(':')
    start, end = rng.split('-')
    if stype not in SPEEDS:
        raise ValueError(f"Unknown segment type '{stype}'. Must be one of: {', '.join(SPEEDS)}")
    return stype, int(start), int(end)


def gen_segments(pts, segment_defs):
    """Generate segments with ts as minute-offsets from start."""
    elapsed_sec = 0.0
    segments = []
    for stype, si, ei in segment_defs:
        speed = SPEEDS[stype]
        coords = []
        for i in range(si, ei + 1):
            if i == si and len(segments) == 0:
                coords.append({'lat': pts[i][0], 'lng': pts[i][1], 'ts': 0.0})
            elif i == si:
                coords.append({'lat': pts[i][0], 'lng': pts[i][1], 'ts': round(elapsed_sec / 60.0, 4)})
            else:
                dist = haversine(pts[i - 1], pts[i])
                elapsed_sec += dist / speed
                coords.append({'lat': pts[i][0], 'lng': pts[i][1], 'ts': round(elapsed_sec / 60.0, 4)})
        segments.append({'type': stype, 'coords': coords})
    return segments


def fmt_js(segments, indent=12):
    sp = ' ' * indent
    sp2 = ' ' * (indent + 2)
    lines = []
    for seg in segments:
        lines.append(f"{sp}{{ type: '{seg['type']}', coords: [")
        for c in seg['coords']:
            lines.append(f"{sp2}{{ lat: {c['lat']}, lng: {c['lng']}, ts: {c['ts']} }},")
        lines.append(f"{sp}]}},")
    return '\n'.join(lines)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    gpx_path = sys.argv[1]
    specs = [parse_segment_spec(s) for s in sys.argv[2:]]

    pts = parse_gpx(gpx_path)
    total_dist = sum(haversine(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
    print(f"Route: {len(pts)} points, {total_dist:.0f}m total", file=sys.stderr)

    segments = gen_segments(pts, specs)

    for seg in segments:
        n = len(seg['coords'])
        last_ts = seg['coords'][-1]['ts']
        print(f"  {seg['type']}: {n} coords, ends at {last_ts:.1f} min", file=sys.stderr)

    print(fmt_js(segments))


if __name__ == '__main__':
    main()
