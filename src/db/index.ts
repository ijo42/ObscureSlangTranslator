import { PrismaClient } from "@prisma/client";
import { debug } from "../app";

const prisma = new PrismaClient({
    log: [
        {
            emit: "event",
            level: "query",
        },
        {
            emit: "stdout",
            level: "error",
        },
        {
            emit: "stdout",
            level: "info",
        },
        {
            emit: "stdout",
            level: "warn",
        },
    ],
});
prisma.$on("query", e => {
    if (debug) {
        console.log(e);
    }
});

export default prisma;