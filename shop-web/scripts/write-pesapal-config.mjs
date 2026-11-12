import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const text = fs.readFileSync(path.join(root, "functions/.env"), "utf8");

function val(name) {
  const line = text.split(/\r?\n/).find((row) => row.startsWith(`${name}=`));
  if (!line) throw new Error(`Missing ${name}`);
  let value = line.slice(name.length + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value;
}

const php = `<?php
return [
  'consumer_key' => ${JSON.stringify(val("PESAPAL_CONSUMER_KEY"))},
  'consumer_secret' => ${JSON.stringify(val("PESAPAL_CONSUMER_SECRET"))},
  'environment' => 'production',
];
`;
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/api/pesapal-config.php");
fs.writeFileSync(out, php);
console.log("CONFIG_OK", fs.statSync(out).size);
