export const EPISODE_WINDOWS = {
  H5: { source: "V1" as const, from: 6, to: 10 },
  H6: { source: "V2" as const, from: 4, to: 9 },
};
const smooth = (x: number) => {
  const p = Math.max(0, Math.min(1, x));
  return p * p * (3 - 2 * p);
};
/** The load occupies the marked x=[-1.5,0.4] path precisely during 6–10 s.
 * Account for the load's authored local z offset and rotated half extents. */
export function episode1Pose(time: number) {
  const t = Math.max(3, Math.min(12, time));
  const angle = (-Math.PI / 2) * smooth((t - 3) / 6);
  const extent =
    2.35 * Math.abs(Math.sin(angle)) + 0.14 * Math.abs(Math.cos(angle));
  const center =
    t < 6
      ? -1.5 - extent - 0.002 - (6 - t) * 0.45
      : t <= 10
        ? -1.5 - extent + ((t - 6) / 4) * (1.9 + 2 * extent)
        : 0.4 + extent + 0.002 + (t - 10) * 0.4;
  return {
    x: center + 0.15 * Math.sin(angle),
    z: 1,
    angle,
    loadMinX: center - extent,
    loadMaxX: center + extent,
  };
}
