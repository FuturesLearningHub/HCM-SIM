/** Diorama layout in meters. Plinth is 22 x 15, centered on the origin. Back wall at z = -7.5, left wall at x = -11. */
export type Vec3 = [number, number, number];

export const PLINTH = { w: 22, d: 15, h: 0.7 };
export const WALL = { h: 3, t: 0.2 };
/** Inner faces of the two walls. */
export const BACK_Z = -PLINTH.d / 2 + WALL.t;
export const LEFT_X = -PLINTH.w / 2 + WALL.t;

/** Three glass offices side by side against the back wall, sharing their partitions. */
export const OFFICE = { w: 3.4, d: 3.4, h: 2.6, z: BACK_Z + 1.7, front: BACK_Z + 3.4 };
export const OFFICES: { id: 'office_a' | 'office_b' | 'office_c'; x: number; label: string }[] = [
  { id: 'office_a', x: LEFT_X + 1.7, label: 'Dana Ortiz, Operations Manager' },
  { id: 'office_b', x: LEFT_X + 5.1, label: 'Marcus Bell, Program Manager' },
  { id: 'office_c', x: LEFT_X + 8.5, label: 'Dr. Helen Park, Director' },
];
/** Where the solid back wall ends and the window wall begins. */
export const WINDOW_X = 4.9;

/**
 * Eight desks on one bench, two rows of four facing each other across a low screen.
 * The back row faces the camera, so you see who is at work.
 */
export const POD = { xs: [-4.75, -3.05, -1.35, 0.35], spine: 1.5, w: 1.6, d: 0.75 };
export const PODS: Record<string, Vec3> = Object.fromEntries(
  POD.xs.flatMap((x, i) => [[`pod_${i + 1}`, [x, 0, POD.spine - 0.42]], [`pod_${i + 5}`, [x, 0, POD.spine + 0.42]]]),
) as Record<string, Vec3>;

export const SPOTS: Record<string, Vec3> = {
  terminal: [6.2, 0, 4.3],
  hcm_2: [8.9, 0, 4.3],
  board: [2.6, 1.7, BACK_Z],
  office_a: [OFFICES[0].x, 0, OFFICE.z + 0.4],
  office_b: [OFFICES[1].x, 0, OFFICE.z + 0.4],
  office_c: [OFFICES[2].x, 0, OFFICE.z + 0.4],
  reception: [-9.4, 0, 3.25],
  break: [8.0, 0, -4.6],
};

/** Where a ring on the floor marks each hotspot. */
export const RING: Record<string, Vec3> = {
  terminal: [6.2, 0, 4.75], hcm_2: [8.9, 0, 4.75], board: [2.6, 0, BACK_Z + 1.2],
  office_a: SPOTS.office_a, office_b: SPOTS.office_b, office_c: SPOTS.office_c,
  reception: [-9.2, 0, 3.25], break: SPOTS.break,
};

export interface Seat {
  /** Where the person sits. */
  pos: Vec3;
  /** Which way they face, in radians about the vertical axis (0 faces the front of the model). */
  ry: number;
  /** Where they step to when they stand up to talk. */
  stand: Vec3;
  /** A seat away from a desk: hands rest in the lap. */
  lounge?: boolean;
}

/** Standing people turn this way, toward the default camera. */
export const TOWARD_CAMERA = Math.PI / 4;

/** Every seat in the office. Standing people turn to face the camera. */
export function seatFor(desk: string): Seat {
  if (PODS[desk]) {
    const [x, , z] = PODS[desk];
    const back = z < POD.spine;
    const sz = back ? z - 0.62 : z + 0.62;
    return { pos: [x, 0, sz], ry: back ? 0 : Math.PI, stand: [x + (back ? 0.1 : 0.3), 0, back ? sz - 0.5 : sz + 0.55] };
  }
  const office = OFFICES.find((o) => o.id === desk);
  if (office) return { pos: [office.x + 0.1, 0, BACK_Z + 0.48], ry: 0, stand: [office.x + 1.05, 0, BACK_Z + 2.2] };
  if (desk === 'hcm_2') { const [x, , z] = SPOTS.hcm_2; return { pos: [x, 0, z + 0.64], ry: Math.PI, stand: [x - 1.15, 0, z + 1.05] }; }
  // A new hire waits on the sofa by the front door on their first morning.
  if (desk === 'reception') return { pos: [LEFT_X + 0.62, 0, 2.75], ry: Math.PI / 2, stand: [LEFT_X + 1.5, 0, 2.6], lounge: true };
  return { pos: [0, 0, 0], ry: 0, stand: [0, 0, 0] };
}

/** Where the camera looks for each hotspot. */
export const FOCUS: Record<string, Vec3> = {
  terminal: [6.6, 0.8, 4.4], board: [2.6, 1.4, BACK_Z + 0.8], office_a: [OFFICES[0].x, 1, OFFICE.z + 0.2], office_b: [OFFICES[1].x, 1, OFFICE.z + 0.2],
  office_c: [OFFICES[2].x, 1, OFFICE.z + 0.2], reception: [-9, 0.8, 3.6], break: [8.4, 0.8, -5.2], overview: [0, 0.4, 0],
};
