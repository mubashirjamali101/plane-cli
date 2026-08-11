/** Shapes of the Plane API resources this CLI reads. Only fields the CLI uses are declared. */

export interface Project {
  id: string;
  name: string;
  description?: string;
}

export interface WorkItem {
  id: string;
  name: string;
  priority: string;
  state: string;
  assignees: string[];
  labels?: string[];
  parent?: string | null;
  cycle?: string | null;
  description_html?: string;
  created_at: string;
  updated_at: string;
  start_date?: string;
  target_date?: string;
  due_date?: string;
  total_time_logged?: string | number;
  sequence_id?: number;
}

export interface State {
  id: string;
  name: string;
  group?: string;
  color?: string;
  description?: string;
  default?: boolean;
}

export interface Label {
  id: string;
  name: string;
  color?: string;
  description?: string;
}

export interface Cycle {
  id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  description?: string;
}

/** Plane versions differ on whether the person is nested under `member` or inlined. */
export interface Member {
  id: string;
  role?: number;
  member?: MemberProfile;
  email?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
}

export interface MemberProfile {
  id?: string;
  email?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
}

export interface Comment {
  id: string;
  comment_html?: string;
  comment_stripped?: string;
  actor?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Link {
  id: string;
  url: string;
  title?: string;
  created_at?: string;
}

export interface Worklog {
  id: string;
  description?: string;
  duration?: number;
  logged_by?: string;
  created_at?: string;
}

export interface Attachment {
  id: string;
  asset?: string;
  asset_url?: string;
  attributes?: { name?: string; type?: string; size?: number };
  created_at?: string;
}

export interface Activity {
  created_at: string;
  actor?: string;
  actor_detail?: { id: string };
  verb: string;
  field?: string;
  old_value?: string;
  new_value?: string;
  comment?: string;
}

/** Presigned-POST credentials Plane hands out before an attachment upload. */
export interface UploadTicket {
  upload_data: { url: string; fields: Record<string, string> };
  asset_id: string;
}

/** Downloaded bytes plus the content type the server reported. */
export interface Asset {
  bytes: Uint8Array;
  contentType: string;
}
