import setupFuzzyCache from "./utils/fuzzySearch";
import setupTelegram, { terminate } from "./telegram/bot";
import setupDrawing from "./utils/drawing";
import setupMetrics from "./metrics";
import prisma from "./db";

export const debug = process.env.debug || false;

async function main() {
    await prisma.$connect();

    await setupFuzzyCache();
    await setupDrawing();

    await setupTelegram();

    await setupMetrics();

    console.log("Service setup successful");
}

main()
    .catch(e => {
        terminate().then(() => process.exit(1));
        throw e;
    });
