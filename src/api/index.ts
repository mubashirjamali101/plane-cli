import type { Config } from "../config.ts";
import { fail } from "../errors.ts";
import { isUuid, memoize } from "../util.ts";
import { PlaneClient } from "./client.ts";
import type {
  Activity, Asset, Attachment, Comment, Cycle, Label, Link, Member, MemberProfile,
  Project, State, UploadTicket, WorkItem, Worklog,
} from "./types.ts";

export { PlaneClient } from "./client.ts";
export * from "./types.ts";

/** The standard REST verbs Plane exposes for a collection of resources. */
export interface Collection<T> {
  list(): Promise<T[]>;
  get(id: string): Promise<T>;
  create(body: Record<string, unknown>): Promise<T>;
  update(id: string, body: Record<string, unknown>): Promise<T>;
  remove(id: string): Promise<void>;
}

function collection<T>(client: PlaneClient, base: string): Collection<T> {
  const at = (id: string) => `${base}${id}/`;
  return {
    list: () => client.getList<T>(base),
    get: (id) => client.get<T>(at(id)),
    create: (body) => client.post<T>(base, body),
    update: (id, body) => client.patch<T>(at(id), body),
    remove: (id) => client.delete(at(id)),
  };
}

/** Entry point: workspace-wide calls, plus a scoped view of a single project. */
export class PlaneApi {
  readonly client: PlaneClient;
  private readonly base: string;

  constructor(config: Config) {
    this.client = new PlaneClient(config);
    this.base = `workspaces/${config.workspace}`;
  }

  projects(): Promise<Project[]> {
    return this.client.getList<Project>(`${this.base}/projects/`);
  }

  project(id: string): ProjectApi {
    return new ProjectApi(this.client, `${this.base}/projects/${id}/`, id);
  }

  /**
   * Every workspace member keyed by user id, for turning the user ids on items and
   * comments into names. Project membership alone does not cover past actors.
   */
  readonly memberNames = memoize(async (): Promise<Map<string, string>> => {
    const members = await this.client.getList<Member>(`${this.base}/members/`);
    const names = new Map<string, string>();
    for (const entry of members) {
      const profile: MemberProfile = entry.member ?? entry;
      if (profile.id) names.set(profile.id, displayName(profile));
    }
    return names;
  });
}

/** Everything scoped to one project. Lookups are fetched at most once per run. */
export class ProjectApi {
  readonly states: Collection<State>;
  readonly labels: Collection<Label>;
  readonly items: Collection<WorkItem>;
  readonly cycles: Collection<Cycle> & {
    addItems(cycleId: string, itemIds: string[]): Promise<void>;
    removeItem(cycleId: string, itemId: string): Promise<void>;
  };

  constructor(
    private readonly client: PlaneClient,
    private readonly base: string,
    readonly id: string
  ) {
    this.states = collection<State>(client, `${base}states/`);
    this.labels = collection<Label>(client, `${base}labels/`);
    this.items = collection<WorkItem>(client, `${base}work-items/`);
    this.cycles = {
      ...collection<Cycle>(client, `${base}cycles/`),
      addItems: (cycleId, itemIds) =>
        client.post(`${base}cycles/${cycleId}/cycle-issues/`, { issues: itemIds }),
      removeItem: (cycleId, itemId) =>
        client.delete(`${base}cycles/${cycleId}/cycle-issues/${itemId}/`),
    };
  }

  item(itemId: string): ItemApi {
    return new ItemApi(this.client, `${this.base}work-items/${itemId}/`, this.id, itemId);
  }

  /** Work items in one page-spanning call; Plane defaults to a small page size. */
  listItems(): Promise<WorkItem[]> {
    return this.client.getList<WorkItem>(`${this.base}work-items/?per_page=100`);
  }

  members(): Promise<Member[]> {
    return this.client.getList<Member>(`${this.base}members/`);
  }

  // ---- cached lookups ----

  private readonly allStates = memoize(() => this.states.list());
  private readonly allLabels = memoize(() => this.labels.list());
  private readonly allCycles = memoize(() => this.cycles.list());

  /** Project members keyed by email, which is what `--assignee` accepts. */
  private readonly membersByEmail = memoize(async (): Promise<Map<string, string>> => {
    const byEmail = new Map<string, string>();
    for (const entry of await this.members()) {
      const email = entry.member?.email ?? entry.email;
      const id = entry.member?.id ?? entry.id;
      if (email && id) byEmail.set(email, id);
    }
    return byEmail;
  });

  async stateNames(): Promise<Map<string, string>> {
    return nameIndex(await this.allStates());
  }

  async labelNames(): Promise<Map<string, string>> {
    return nameIndex(await this.allLabels());
  }

  async cycleNames(): Promise<Map<string, string>> {
    return nameIndex(await this.allCycles());
  }

  // ---- resolvers (human input -> UUID) ----

  async resolveState(name: string): Promise<string> {
    const states = await this.allStates();
    const match = states.find((state) => state.name === name)
      ?? states.find((state) => state.name.toLowerCase() === name.toLowerCase());
    if (!match) fail(`state '${name}' not found. Available: ${states.map((s) => s.name).join(", ")}`);
    return match.id;
  }

  /** Resolve state names to ids; unknown names are reported together. */
  async resolveStates(names: string[]): Promise<string[]> {
    return Promise.all(names.map((name) => this.resolveState(name)));
  }

  async resolveMembers(emails: string[]): Promise<string[]> {
    const byEmail = await this.membersByEmail();
    return emails.map((email) => {
      const id = isUuid(email) ? email : byEmail.get(email);
      if (!id) fail(`assignee '${email}' is not a member of this project. Available: ${[...byEmail.keys()].join(", ")}`);
      return id;
    });
  }

  async resolveLabels(names: string[]): Promise<string[]> {
    const labels = await this.allLabels();
    const byName = new Map(labels.map((label) => [label.name.toLowerCase(), label.id]));
    return names.map((name) => {
      const id = isUuid(name) ? name : byName.get(name.toLowerCase());
      if (!id) fail(`label '${name}' not found. Available: ${labels.map((l) => l.name).join(", ")}`);
      return id;
    });
  }

  async resolveCycle(nameOrId: string): Promise<string> {
    if (isUuid(nameOrId)) return nameOrId;
    const cycles = await this.allCycles();
    const match = cycles.find((cycle) => cycle.name.toLowerCase() === nameOrId.toLowerCase());
    if (!match) fail(`cycle '${nameOrId}' not found. Available: ${cycles.map((c) => c.name).join(", ")}`);
    return match.id;
  }
}

/** Everything hanging off a single work item. */
export class ItemApi {
  readonly comments: Collection<Comment>;
  readonly links: Collection<Link>;
  readonly worklogs: Collection<Worklog>;
  readonly attachments: Collection<Attachment>;

  constructor(
    private readonly client: PlaneClient,
    private readonly base: string,
    readonly projectId: string,
    readonly id: string
  ) {
    this.comments = collection<Comment>(client, `${base}comments/`);
    this.links = collection<Link>(client, `${base}links/`);
    this.worklogs = collection<Worklog>(client, `${base}worklogs/`);
    this.attachments = collection<Attachment>(client, `${base}attachments/`);
  }

  activity(): Promise<Activity[]> {
    return this.client.getList<Activity>(`${this.base}activities/`);
  }

  /** The Plane instance root, for resolving site-relative image sources. */
  get origin(): string {
    return this.client.origin;
  }

  /** Download asset bytes with authentication. */
  fetchAsset(url: string): Promise<Asset> {
    return this.client.fetchAsset(url);
  }

  /**
   * URL that serves an asset attached to (or embedded in) this item.
   *
   * The `/api/assets/v2/...` route the web app uses is session-cookie authenticated and
   * rejects an API key outright, which is why embedded screenshots look undownloadable.
   * The work-item attachment route resolves the same asset ids, accepts `x-api-key`, and
   * redirects to the presigned storage URL — so that is the one the CLI uses.
   */
  assetUrl(assetId: string): string {
    return this.client.url(`${this.base}attachments/${assetId}/`);
  }

  /** Plane's three-step upload: reserve, PUT the bytes to storage, then confirm. */
  async upload(bytes: Uint8Array, filename: string, contentType: string): Promise<string> {
    const ticket = await this.client.post<UploadTicket>(`${this.base}attachments/`, {
      name: filename,
      type: contentType,
      size: bytes.length,
    });
    await this.client.uploadToStorage(ticket.upload_data, bytes, filename, contentType);
    await this.client.patch(`${this.base}attachments/${ticket.asset_id}/`, { is_uploaded: true });
    return ticket.asset_id;
  }
}

export function displayName(profile: MemberProfile): string {
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  return profile.display_name || full || profile.email || profile.id || "unknown";
}

function nameIndex(records: { id: string; name: string }[]): Map<string, string> {
  return new Map(records.map((record) => [record.id, record.name]));
}
