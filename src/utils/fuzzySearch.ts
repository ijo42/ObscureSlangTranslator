import Fuse from "fuse.js";
import { ObscureEntry } from "../templates";
import prisma from "../db";
import { compiledRegexp } from "./regexpBuilder";

const options = {
    includeScore: true,
    minMatchCharLength: 2,
    threshold: 0.55,
    distance: 10,
    useExtendedSearch: true,
    keys: [
        "term",

        {
            name: "value",
            weight: 0.5,
        },
        {
            name: "synonyms",
            weight: 0.85,
        },
    ],
};

const fuse: Fuse<ObscureEntry> = new Fuse([], options);

export default async function setup(): Promise<void> {
    await prisma.obscure.findMany({
        select: {
            id: true,
            value: true,
            term: true,
            synonyms: true,
        },
    })
        .then(val => fuse.setCollection(val));
}

export function pushTerm(term: ObscureEntry): void {
    const fuzzy = fuse.search({
        term: term.term,
        value: term.value,
    })[0];
    if (fuzzy && fuzzy.score === 0.0) {
        throw new Error("Duplicate key");
    } else {
        fuse.add(term);
    }
}

export function editTerm(term: ObscureEntry, operation: (t: ObscureEntry) => void): void {
    fuse.remove((doc: ObscureEntry) => term === doc);
    operation(term);
    fuse.add(term);
}

export function eraseTerm(term: ObscureEntry): void {
    fuse.remove((doc: ObscureEntry) => term === doc);
}

export function fuzzySearchWithLen(query: (string[] | null), num: number): ObscureEntry[] {
    return query ? fuse.search(query.join(" | ")).slice(0, num)
        .map(value => value.item) : [];
}

export function fuzzySearch(query: (string[] | null)): ObscureEntry | undefined {
    return fuzzySearchWithLen(query, 1)[0];
}

export function findAndValidateTerm(text: string): (ObscureEntry | undefined) {
    if (!compiledRegexp.fullMatch.test(text)) {
        return;
    }

    return fuzzySearch(text.replace(/(\s)?-(\s)?/, " ")
        .split(" "));
}

export function findAndValidateCategory(text: string):Promise<null | {
    value: string;
    id: number;
}> {
    if (!compiledRegexp.categoryDef.test(text)) {
        return Promise.resolve(null);
    }
    return prisma.categories.findFirst({
        where: {
            value: text,
        },
        select: {
            value: true,
            id: true,
        },
    });
}

export function findByIds(ids: number[]): (ObscureEntry | undefined)[] {
    return ids.map(termId => fuse.search({
        id: termId.toString(),
    }, {
        limit: 1,
    }))
        .map(e => e[0]?.item);
}
