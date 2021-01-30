import Fuse from "fuse.js";
import {queries} from "../db/patterns";
import {QueryResult} from "pg";
import {ObscureEntry} from "../templates";

const db = require("../db")

const options = {
    includeScore: true,
    keys: [
        'term',

        {
            name: 'value',
            weight: 0.4
        },
        {
            name: 'synonyms',
            weight: 0.9
        }
    ]
}

// initialize Fuse with the index
export let fuse: Fuse<ObscureEntry>;

export default function setup(): void {
    db.query(queries.obscureCache).then((res: QueryResult): void => {
        fuse = new Fuse(res.rows, options);
    }).catch((e: any) => console.error(e.stack));
}
