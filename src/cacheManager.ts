import {queries} from "./db/patterns";
import {QueryResult} from "pg";
import {ObscureEntry} from "./templates";

const db = require("./db")
export let obscureCache: Array<ObscureEntry>;

export default function setup(): void {
    db.query(queries.obscureCache).then((res: QueryResult): void => {
        obscureCache =
            res.rows.filter(value => value["term"] && value["value"] && value["synonyms"]).map<ObscureEntry>(value =>
                new ObscureEntry(value.term, value.value, value.synonyms));
    }).catch((e: any) => console.error(e.stack));
}
