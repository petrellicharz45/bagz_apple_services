import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const key = JSON.parse(fs.readFileSync(path.join(root, "firebase-adminsdk.json"), "utf8"));
const php = `<?php
return [
  'project_id' => ${JSON.stringify(key.project_id)},
  'client_email' => ${JSON.stringify(key.client_email)},
  'private_key' => ${JSON.stringify(key.private_key)},
];
`;
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/api/firestore-config.php");
fs.writeFileSync(out, php);
console.log("CONFIG_OK", fs.statSync(out).size);
