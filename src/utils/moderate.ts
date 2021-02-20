import { queries } from "../db/patterns";
import { QueryResult } from "pg";

const db = require("../db");
const moderators: number[] = [];

export default async function setup() {
    await db.query(queries.moderatorCache).then((res: QueryResult) => {
        res.rows.forEach(value => moderators.push(value.user_id));
    }).catch((e: any) => console.error(e.stack));
}

export function hasRights(userId: number): boolean {
    return moderators.includes(userId);
}

export function promoteUser(promotable: number, promoter: number): Promise<number> {
    return db.query(queries.insertModerator, [promotable, promoter]).then(() => moderators.push(promotable));
}