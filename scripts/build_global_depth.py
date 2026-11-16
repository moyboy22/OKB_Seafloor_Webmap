#!/usr/bin/env python3
"""Create a coarse GLOBAL GEBCO Terrain-RGB MBTiles from a GEBCO elevation GeoTIFF.

Install: python -m pip install rasterio numpy pillow
Run: python scripts/build_global_depth.py GEBCO_2026.tif global_depth.mbtiles
Then: pmtiles convert global_depth.mbtiles GEBCO_2026_Global_TerrainRGB_Z5.pmtiles

Encoding EXACTLY matches depth.js: height = 256*G+B-32768 (R=0).
NoData is encoded as +32767; MapLibre's depth ramp makes it transparent.
This script uses bounded tile windows instead of allocating a world raster.
"""
import argparse
import io
import math
import sqlite3
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT
from rasterio.windows import Window
from rasterio.transform import from_bounds

MERCATOR_LIMIT = 20037508.342789244
NODATA_ELEVATION = 32767


def encode_tile(tile):
    values = np.asarray(np.ma.filled(tile, np.nan), dtype=np.float32)
    valid = np.isfinite(values) & (values >= -32768) & (values <= 32766)
    elevations = np.full(values.shape, NODATA_ELEVATION, dtype=np.int32)
    elevations[valid] = np.rint(values[valid]).astype(np.int32)
    packed = (elevations + 32768).astype(np.uint16)
    rgb = np.empty((*packed.shape, 3), dtype=np.uint8)
    rgb[:, :, 0] = 0
    rgb[:, :, 1] = (packed >> 8).astype(np.uint8)
    rgb[:, :, 2] = (packed & 255).astype(np.uint8)
    out = io.BytesIO()
    Image.fromarray(rgb, "RGB").save(out, format="PNG", optimize=True)
    return out.getvalue()


def build(source_path, output_path, max_zoom):
    size = 256 * (1 << max_zoom)
    transform = from_bounds(-MERCATOR_LIMIT, -MERCATOR_LIMIT,
                            MERCATOR_LIMIT, MERCATOR_LIMIT, size, size)
    output_path = Path(output_path)
    if output_path.exists():
        raise FileExistsError("Refusing to overwrite " + str(output_path))
    db = sqlite3.connect(output_path)
    try:
        db.execute("CREATE TABLE metadata (name TEXT PRIMARY KEY, value TEXT)")
        db.execute("CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, "
                   "tile_row INTEGER, tile_data BLOB, "
                   "PRIMARY KEY (zoom_level,tile_column,tile_row))")
        meta = {
            "name": "GEBCO 2026 global signed-16 Terrain-RGB",
            "type": "baselayer", "version": "1", "format": "png",
            "bounds": "-180,-85.05112878,180,85.05112878",
            "minzoom": "0", "maxzoom": str(max_zoom)
        }
        db.executemany("INSERT INTO metadata VALUES (?,?)", meta.items())
        with rasterio.open(source_path) as src:
            with WarpedVRT(src, crs="EPSG:3857", transform=transform,
                           width=size, height=size, dtype="float32",
                           resampling=Resampling.bilinear) as vrt:
                for zoom in range(max_zoom + 1):
                    n = 1 << zoom
                    factor = 1 << (max_zoom - zoom)
                    for y in range(n):
                        for x in range(n):
                            window = Window(x * 256 * factor,
                                            y * 256 * factor,
                                            256 * factor, 256 * factor)
                            tile = vrt.read(1, window=window,
                                            out_shape=(256, 256),
                                            resampling=Resampling.bilinear,
                                            masked=True)
                            png = encode_tile(tile)
                            db.execute("INSERT INTO tiles VALUES (?,?,?,?)",
                                       (zoom, x, n - 1 - y, png))
                    db.commit()
                    print(f"Completed global z{zoom}: {n*n} tiles", flush=True)
        db.execute("CREATE UNIQUE INDEX tile_index ON "
                   "tiles (zoom_level, tile_column, tile_row)")
        db.commit()
    except Exception:
        db.close()
        output_path.unlink(missing_ok=True)
        raise
    db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", help="GEBCO elevation GeoTIFF")
    parser.add_argument("output", help="New MBTiles output filename")
    parser.add_argument("--max-zoom", type=int, default=5, choices=range(0, 7))
    args = parser.parse_args()
    build(args.source, args.output, args.max_zoom)
