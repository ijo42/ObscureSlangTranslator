import Fuse from "fuse.js";
import {queries} from "../db/patterns";
import {QueryResult} from "pg";
import {ObscureEntry} from "../templates";
import {formatAnswer} from "./formatting";

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

export const fuzzySearch = (query: string[] | null) => {
    if (query)
        for (let q of query) {
            const [first] = fuse.search(q);
            if (first)
                return first.item;
        }
    return false;
}

export const fuzzyFormat: (query: (string[] | null)) => string = (query: string[] | null) => {
    const entry = fuzzySearch(query);
    if (entry)
        return formatAnswer(entry);
    else
        return "IDK";
}