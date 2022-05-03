import { categories, obscure } from "@prisma/client";
import Fuse from "fuse.js";
import prisma from "../db";
import { compiledRegexp } from "./regexpBuilder";
import { TermInteraction } from "../db/interaction";

const options: Fuse.IFuseOptions<obscure> = {
    fieldNormWeight: 1,
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

const fuse: Fuse<obscure> = new Fuse([], options);

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

export function pushTerm(term: obscure): void {
    fuse.add(term);
}

export function editTerm(term: obscure, operation: (t: obscure) => void): void {
    fuse.remove((doc: obscure) => term === doc);
    operation(term);
    fuse.add(term);
}

export function eraseTerm(term: obscure): void {
    fuse.remove((doc: obscure) => term === doc);
}

export function fuseSearchWithLen(query: (string[] | null), num: number): Fuse.FuseResult<obscure>[] {
    return query ? fuse.search(query.join(" | "))
        .slice(0, num) : [];
}

export function fuzzySearchWithLen(query: (string[] | null), num: number): obscure[] {
    return fuseSearchWithLen(query, num)
        .map(value => value.item);
}

export function fuzzySearch(query: (string[] | null)): obscure | undefined {
    return fuzzySearchWithLen(query, 1)[0];
}

export function findAndValidateTerm(text: string): (obscure | undefined) {
    if (!compiledRegexp.fullMatch.test(text)) {
        return;
    }

    return fuzzySearch(text.replace(/(\s)?-(\s)?/, " ")
        .split(" "));
}

export function findAndValidateCategory(text: string): Promise<null | categories> {
    if (!compiledRegexp.categoryDef.test(text)) {
        return Promise.resolve(null);
    }
    return prisma.categories.findFirst({
        where: {
            value: text,
        },
    });
}

export function findByIds(ids: number[]): (obscure | undefined)[] {
    return ids.map(termId => fuse.search({
        id: termId.toString(),
    }, {
        limit: 1,
    }))
        .map(e => e[0]?.item);
}

export function deleteTerm(obscureTerm: obscure): Promise<void> {
    return TermInteraction.deleteTerm(obscureTerm)
        .then(() => eraseTerm(obscureTerm));
}
