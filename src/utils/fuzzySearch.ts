import Fuse from "fuse.js";
import { ObscureEntry } from "../templates";
import { formatAnswer } from "./formatting";
import prisma from "../db";

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

let fuse: Fuse<ObscureEntry>;

export default async function setup() {
    await prisma.obscure.findMany({
        select: {
            id: true,
            value: true,
            term: true,
            synonyms: true
        }
    }).then(val =>
        fuse = new Fuse(val, options));
}

export function pushTerm(term: ObscureEntry) {
    const fuzzy = fuse.search({
        $and: [{term: term.term}, {value: term.value}]
    })[0];
    if (fuzzy && fuzzy.score == 0)
        throw new Error("Duplicate key");
    else
        fuse.add(term);
}

export function editTerm(term: ObscureEntry, operation: (t: ObscureEntry) => void) {
    fuse.remove((doc: ObscureEntry) => term == doc);
    operation(term);
    fuse.add(term);
}

export const fuzzySearchWithLen: (query: (string[] | null), num: number) => ObscureEntry[] = (query: string[] | null, num: number) => {
    return query ? fuse.search(query.join(' | ')).slice(0, num).map(value => value.item) : [];
}

export const fuzzySearch: (query: (string[] | null)) => ObscureEntry | undefined = (query: string[] | null) => {
    return fuzzySearchWithLen(query, 1)[0];
}

export const fuzzyFormat: (query: (string[] | null)) => string = (query: string[] | null) => {
    const entry = fuzzySearch(query);
    return entry ? formatAnswer(entry) : "*IDK*";
}