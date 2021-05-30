import client from "prom-client";
import http from "http";

export namespace Metrics {
    export const renderDurationMicroseconds = new client.Histogram({
        name: "render_duration_seconds",
        help: "Duration of image render",
        labelNames: ["method", "render", "code"],
        buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
    });

    export const commandTermRequests = new client.Counter({
        name: "command_term_requests",
        help: "Counter for term requests by commands",
        labelNames: ["method", "request", "search", "code"],
    });

    export const inlineRequests = new client.Counter({
        name: "inline_requests",
        help: "Counter for inline request from telegram",
        labelNames: ["method", "request", "search", "code"],
    });

    export const successfulTermSearch = new client.Counter({
        name: "successful_term_search",
        help: "Counter for term search that's end's successfully",
        labelNames: ["method", "result", "search", "code"],
    });

    export const failedTermSearch = new client.Counter({
        name: "failed_term_search",
        help: "Counter for term search that's end's with fail",
        labelNames: ["method", "result", "search", "code"],
    });
}

export default async function app(): Promise<void> {
    const register = new client.Registry();
    client.collectDefaultMetrics({ register });

    register.registerMetric(Metrics.renderDurationMicroseconds);
    register.registerMetric(Metrics.commandTermRequests);
    register.registerMetric(Metrics.inlineRequests);
    register.registerMetric(Metrics.successfulTermSearch);
    register.registerMetric(Metrics.failedTermSearch);

    const server = http.createServer((_req, res) => {
        res.setHeader("Content-Type", register.contentType);
        register.metrics().then(chunk => res.end(chunk));
    });

    await server.listen(8080);
}