"use strict";
import { PromisePool } from "@supercharge/promise-pool";
import axios from "axios";
import rateLimit from "axios-rate-limit";
import { Option, program } from "commander";
import fs from "fs";

const baseUrl = "https://kemono.su";

program
    .addOption(new Option("-i, --id <id>", "Creator id").makeOptionMandatory())
    .addOption(
        new Option("-p, --platform <platform>", "Platform (patreon by default)").default("patreon")
    )
    .addOption(
        new Option("-d, --dir <path>", "Directory to download files to").default("./downloads")
    )
    .addOption(
        new Option(
            "-n, --parallel <parallel>",
            "Number of downloads in parallel (might encounter error 429 if the number is too high)"
        ).default(3)
    );

program.parse();

const creatorId = program.opts().id;
const platform = program.opts().platform;
const baseDir = program.opts().dir;
const rps = program.opts().parallel;

const poolSize = rps * 2;
const http = rateLimit(axios.create(), {
    maxRPS: rps,
});

let o = 0;
let files = [];
let complete = [];
while (true) {
    let res = await runWith429Reprocessed(
        async () => await http.get(`${baseUrl}/api/v1/${platform}/user/${creatorId}?o=${o}`)
    );
    console.log(`Requesting posts ${o}-${o + 50}`);
    if (res.data.length == 0) {
        console.log("Done gathering urls");
        break;
    }
    for (const post of res.data) {
        for (const file of post.attachments) {
            //ignore duplicates
            if (files.find(f => f.path === file.path) !== undefined) continue;

            let extention = file.path.split(".").at(-1);
            let composedName = `${post.title}__[${file.name}].${extention}`;
            files.push({ name: composedName, path: file.path });
        }
    }
    o += 50;
}
console.log(`Gathered ${files.length} urls`);

if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir);
}
if (!fs.existsSync(`${baseDir}/${creatorId}`)) {
    fs.mkdirSync(`${baseDir}/${creatorId}`);
}

//try to continue the download
try {
    let lockdata = fs.readFileSync(`${baseDir}/${creatorId}/download.lock`, { encoding: "utf8" });
    complete = JSON.parse(lockdata);
    let finished = complete.map(it => it.path);
    files = files.filter(it => !finished.includes(it.path));
    console.log(`Resumed download detected, only ${files.length} files remain`);
} catch (e) {
    if (e?.code !== "ENOENT") {
        console.log(e);
    }
}

let comletionCounter = 0;
const total = files.length;
await PromisePool.for(files)
    .withConcurrency(poolSize)
    .onTaskFinished(item => {
        console.log(`Downloaded ${++comletionCounter}/${total} files`);
        complete.push(item);
        saveItemLock();
    })
    .handleError(async (e, file) => {
        if (e === "F2CF") {
            console.log(`Failed to create file: ${file.name}`);
            return;
        }
    })
    .process(async file => {
        console.log(`Working on file: ${file.name}`);
        await runWith429Reprocessed(() => saveImage(`${baseUrl}${file.path}`, file.name));
    });
console.log("Download complete, exiting");

async function saveImage(imgUrl, fileName) {
    let img = await axios.get(imgUrl, { responseType: "stream" });
    //make file name path safe
    let saveName = fileName.replaceAll(/([^a-zA-Z_ .0-9\][()])/g, "");

    let outputStream = fs.createWriteStream(`${baseDir}/${creatorId}/${saveName}`);
    img.data.pipe(outputStream);
    await Promise.race([
        new Promise(r =>
            outputStream.on("finish", () => {
                console.log(`Saved: ${saveName}`);
                r();
            })
        ),
        new Promise((r, rj) =>
            outputStream.on("error", e => {
                if (e.code === "ENOENT") rj("F2CF");
                else console.log(e);
            })
        ),
    ]);
}

async function runWith429Reprocessed(callback) {
    let complete = false;
    while (!complete) {
        try {
            return await callback();
        } catch (e) {
            if (e.response?.status != 429) {
                break;
            }
            console.log("Http error 429 encountered, reprocessing");
            //cooldown a bit
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

async function saveItemLock() {
    try {
        fs.writeFileSync(
            `${baseDir}/${creatorId}/download.lock`,
            JSON.stringify(complete),
            "utf8",
            e => {
                if (e !== null) console.log(e);
            }
        );
    } catch (e) {
        console.log(`Unable to create lock file, ${e.code}`);
    }
}
