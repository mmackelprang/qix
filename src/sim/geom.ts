/**
 * Integer segment geometry for collision tests. Inputs are quantized to
 * integers before testing, so orientation arithmetic is exact.
 */

type Orient = -1 | 0 | 1;

function orient(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): Orient {
  const v = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

function onSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
): boolean {
  return (
    Math.min(ax, bx) <= px &&
    px <= Math.max(ax, bx) &&
    Math.min(ay, by) <= py &&
    py <= Math.max(ay, by)
  );
}

/** Do segments AB and CD intersect (including touching and collinear overlap)? */
export function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const o1 = orient(ax, ay, bx, by, cx, cy);
  const o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay);
  const o4 = orient(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(ax, ay, bx, by, cx, cy)) return true;
  if (o2 === 0 && onSegment(ax, ay, bx, by, dx, dy)) return true;
  if (o3 === 0 && onSegment(cx, cy, dx, dy, ax, ay)) return true;
  if (o4 === 0 && onSegment(cx, cy, dx, dy, bx, by)) return true;
  return false;
}

/** Is point P on segment AB? */
export function pointOnSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
): boolean {
  return orient(ax, ay, bx, by, px, py) === 0 && onSegment(ax, ay, bx, by, px, py);
}
