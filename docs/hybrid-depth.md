# Hybrid GEBCO numerical depth highlighting

## Deployment state

The existing regional depth highlighter is preserved. The new global tier is
**optional** and will remain disabled until a valid global PMTiles archive is
hosted. Global **WMS imagery is not numerical elevation data** and is not used
to calculate depth highlighting.

- Regional source: `GEBCO_2026_TerrainRGB_Z8.pmtiles` (preferred), then
  `GEBCO_2026_TerrainRGB_Z7.pmtiles` (fallback).
- Global source: `GEBCO_2026_Global_TerrainRGB_Z5.pmtiles` at the site root,
  or an HTTPS URL configured as `window.OKB_GLOBAL_DEPTH_URL` **before**
  loading `depth.js`.
- Global archive must return **HTTP 206 Partial Content** to a byte-range GET,
  with CORS allowing the site's origin if hosted on R2.
- Both sources use the existing signed-16 custom RGB encoding:
  `elevation = 65536*R + 256*G + B - 32768`, where R is always 0,
  and +32767 denotes NoData.

## Build the global archive

Use a legally redistributable GEBCO 2026 **elevation** GeoTIFF covering the
world (not a hillshade, WMS screenshot, or colour-mapped raster). For Windows
with a Python environment containing GDAL/Rasterio:

```sh
python -m pip install rasterio numpy pillow
python scripts/build_global_depth.py GEBCO_2026.tif global_depth.mbtiles --max-zoom 5
pmtiles convert global_depth.mbtiles GEBCO_2026_Global_TerrainRGB_Z5.pmtiles
```

The helper writes PNG RGB tiles at z0–5 directly into an MBTiles SQLite
database, processing one tile at a time. This avoids holding a worldwide grid
in memory. It assumes the input stores **metres as signed elevations** and
is readable by Rasterio. It is important to verify that an external source
has the expected vertical datum, resolution, and NoData convention. Zoom 5
is suitable for *overview highlighting*, not detailed seabed interpretation.

Place the resulting archive in GitHub Pages' published site root **if it
fits the deployment limits**; for larger archives, host on Cloudflare R2 with
public range GETs and CORS allowed for the GitHub Pages origin. For R2,
add this snippet above the `depth.js` script in `index.html`:

```html
<script>
  window.OKB_GLOBAL_DEPTH_URL =
    "https://YOUR-PUBLIC-R2-HOST/GEBCO_2026_Global_TerrainRGB_Z5.pmtiles";
</script>
```

Do not commit private R2 access tokens, account keys or credentials.
Public PMTiles archives should use public GET access, with R2 access controls
and abuse-cost monitoring appropriate for your deployment. If adding an R2
custom domain, configure CORS to allow GET and HEAD with the Range header
from your site's origin, and expose Content-Range/Accept-Ranges as appropriate.

## Rendering behaviour and safeguards

- When both archives exist, MapLibre shows the **global** tier at overview
  zooms and at locations outside the regional coverage. At zoom >=6 with
  camera centre inside the regional bounds, it switches to the **regional**
  tier. Only **one** numeric depth relief is visible at once, preventing
  double opacity and conflicting depth values at overlapping tiles.
- When the global archive is absent or cannot support 206 range requests,
  the existing regional highlighter remains operational.
- When the regional archive is absent, global alone can still work.
- Inputs for range, opacity and colour picker update whichever tier is active.
- The regional switch is camera-centre-based rather than exact per-pixel
  masking; when a viewport straddles the regional boundary, the active tier
  applies to that viewport. This avoids overlap artifacts but means the
  coarser tier can be visible inside some boundary-crossing views.
- At high zoom outside regional coverage, global z5 is **overscaled**:
  no additional information is produced by zooming in.
- The original GEBCO basemap, contour, SPRFMO overlays, and navigation tools
  remain separate from this system.

## Acceptance tests

1. Before uploading global archive, verify red (or chosen colour) regional
   depth highlighting, the 1000–2000 m default and opacity control still work.
2. Confirm that the browser console reports global archive unavailable and
   that normal map tools and basemaps are unaffected.
3. After uploading the archive, test a global view outside the Southern Ocean,
   depth-range presets, colour picker, opacity slider, and on/off control.
4. Zoom to the regional bounds (roughly 113.84–179.9 E and 45–64.44 S);
   at zoom >=6 the highlighter should switch to regional detail.
5. Pan outside the regional bounds: global overview should return; check both
   directions, including across the antimeridian.
6. Simulate failed global tile requests: verify regional fallback remains and
   warning is logged in the console.
7. Test partial-range headers with
   `curl -I -H "Range: bytes=0-15" YOUR_ARCHIVE_URL` and a GET request;
   ensure the GET returns HTTP 206 and the first bytes are PMTiles.

## Licensing and scientific limitations

GEBCO Compilation Group (2026) attribution remains required. The rendered
map is **not for navigation**. The global tier is downsampled from the
underlying GEBCO grid; it does not imply multibeam-resolution coverage or
uniform confidence. Use the GEBCO TID grid when communicating certainty.
Do not bundle third-party restricted bathymetry into these publicly
downloadable PMTiles archives without the applicable redistribution rights.
