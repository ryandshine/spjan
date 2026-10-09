import type { LogAuditDto } from "@spjan/shared";

import type { SessionUser } from "../auth.js";
import type { Db } from "../db.js";

export interface CatatanAudit {
  aksi: string;
  entitas: string;
  entitasId?: number | null;
  stId?: number | null;
  alasan?: string | null;
  detail?: unknown;
}

export async function catatAudit(db: Db, user: Pick<SessionUser, "id" | "username">, c: CatatanAudit): Promise<void> {
  await db.query(
    `insert into log_audit (user_id, username, aksi, entitas, entitas_id, st_id, alasan, detail)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [user.id, user.username, c.aksi, c.entitas, c.entitasId ?? null, c.stId ?? null, c.alasan ?? null, c.detail === undefined ? null : JSON.stringify(c.detail)],
  );
}

export async function daftarAudit(db: Db, opts: { stId?: number; limit: number }): Promise<LogAuditDto[]> {
  const { rows } = await db.query<{
    id: number;
    waktu: Date;
    username: string;
    aksi: string;
    entitas: string;
    entitas_id: number | null;
    st_id: number | null;
    alasan: string | null;
    detail: unknown;
  }>(
    `select id, waktu, username, aksi, entitas, entitas_id, st_id, alasan, detail from log_audit
      where ($1::bigint is null or st_id = $1) order by id desc limit $2`,
    [opts.stId ?? null, opts.limit],
  );
  return rows.map((r) => ({
    id: r.id,
    waktu: r.waktu.toISOString(),
    username: r.username,
    aksi: r.aksi,
    entitas: r.entitas,
    entitasId: r.entitas_id,
    stId: r.st_id,
    alasan: r.alasan,
    detail: r.detail,
  }));
}
