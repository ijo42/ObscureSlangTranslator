import Fuse from "fuse.js";
import {queries} from "../db/patterns";
import {QueryResult} from "pg";
import {ObscureEntry} from "../templates";
import {formatAnswer} from "./formatting";

const db = require("../db")

const options = {
    includeScore: true,
    minMatchCharLength: 2,
    threshold: 0.55,
    useExtendedSearch: true,
    keys: [
        'term',

        {
            name: 'value',
            weight: 0.5
        },
        {
            name: 'synonyms',
            weight: 0.85
        }
    ]
}

export let fuse: Fuse<ObscureEntry>;

export default function setup(): void {
    db.query(queries.obscureCache).then((res: QueryResult): void => {
        fuse = new Fuse(res.rows, options);
    }).catch((e: any) => console.error(e.stack));
}

export const fuzzySearch: (query: (string[] | null)) => ObscureEntry | undefined = (query: string[] | null) => {
    return query ? fuse.search(query.join(' | '))[0]?.item : undefined;
}

export const fuzzyFormat: (query: (string[] | null)) => string = (query: string[] | null) => {
    const entry = fuzzySearch(query);
    return entry ? formatAnswer(entry) : "IDK";
}