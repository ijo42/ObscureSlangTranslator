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

export const fuzzySearchWithLen: (query: (string[] | null), num: number) => ObscureEntry[] = (query: string[] | null, num: number) => query ? fuse.search(query.join(" | "))
    .slice(0, num)
    .map(value => value.item) : [];

export const fuzzySearch: (query: (string[] | null)) => ObscureEntry | undefined = (query: string[] | null) => fuzzySearchWithLen(query, 1)[0];

export const findAndValidateTerm: (text: string) => (ObscureEntry | undefined) = (text: string) => {

    if (!compiledRegexp.fullMatch.test(text)) {
        return;
    }

    return fuzzySearch(text.replace(/(\s)?-(\s)?/, " ")
        .split(" "));
};

export const findAndValidateCategory: (text: string) => Promise<undefined | {
    value: string;
    id: number;
}> = async (text: string) => {

    if (!compiledRegexp.categoryDef.test(text)) {
        return;
    }
    let k;
    await prisma.categories.findFirst({
        where: {
            value: text,
        },
        select: {
            value: true,
            id: true,
        },
    }).then(e => k = e);
    return k;
};

export const findByIds: (ids: number[]) => (ObscureEntry | undefined)[] = (ids: number[]) => ids.map(termId => fuse.search({
    id: termId.toString(),
}, {
    limit: 1,
}))
    .map(e => e[0]?.item);
