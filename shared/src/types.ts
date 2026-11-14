export interface WaypointList {
  id: number;
  name: string;
  waypointCount: number;
}

export interface Waypoint {
  id: number;
  listId: number;
  position: number;
  lat: number;
  lng: number;
  label: string;
  radius: number | null;
  /** 遊戲內 Spot 的名稱（ticket 05 Postcard Check 會用）。 */
  spotName: string | null;
}

export interface ImportLineError {
  line: number;
  text: string;
  reason: string;
}

export interface ImportResult {
  imported: Waypoint[];
  errors: ImportLineError[];
}
