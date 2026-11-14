<?php
require __DIR__ . "/app-cors.php";
header("Content-Type: application/json");
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode(["message" => "Use POST."]);
  exit;
}
$body = json_decode(file_get_contents("php://input"), true);
$ids = is_array($body["ids"] ?? null) ? $body["ids"] : [];
$clean = [];
foreach ($ids as $id) {
  $id = trim((string) $id);
  if (preg_match('/^FD-\d{10,15}-[a-z0-9]{3,10}$/', $id)) $clean[] = $id;
  if (count($clean) >= 20) break;
}
if (!$clean) {
  echo json_encode(["orders" => new stdClass()]);
  exit;
}
$file = __DIR__ . "/firestore-config.php";
if (!is_file($file)) {
  echo json_encode(["orders" => new stdClass()]);
  exit;
}
$key = include $file;

function b64url($data) {
  return rtrim(strtr(base64_encode($data), "+/", "-_"), "=");
}
function field_string($fields, $name) {
  $v = $fields[$name] ?? null;
  return is_array($v) ? (string) ($v["stringValue"] ?? "") : "";
}
function field_ms($fields, $name) {
  $v = $fields[$name] ?? null;
  if (!is_array($v) || empty($v["timestampValue"])) return 0;
  $ms = strtotime($v["timestampValue"]);
  return $ms ? $ms * 1000 : 0;
}

$now = time();
$header = b64url(json_encode(["alg" => "RS256", "typ" => "JWT"]));
$claim = b64url(json_encode([
  "iss" => $key["client_email"],
  "scope" => "https://www.googleapis.com/auth/datastore",
  "aud" => "https://oauth2.googleapis.com/token",
  "iat" => $now,
  "exp" => $now + 3600
]));
$signature = "";
openssl_sign($header . "." . $claim, $signature, $key["private_key"], OPENSSL_ALGO_SHA256);
$ch = curl_init("https://oauth2.googleapis.com/token");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ["Content-Type: application/x-www-form-urlencoded"],
  CURLOPT_POSTFIELDS => http_build_query([
    "grant_type" => "urn:ietf:params:oauth:grant-type:jwt-bearer",
    "assertion" => $header . "." . $claim . "." . b64url($signature)
  ]),
  CURLOPT_TIMEOUT => 20
]);
$tokenRaw = curl_exec($ch);
curl_close($ch);
$tokenData = json_decode($tokenRaw ?: "", true);
$access = (string) (is_array($tokenData) ? ($tokenData["access_token"] ?? "") : "");
$orders = [];
if ($access !== "") {
  $project = rawurlencode($key["project_id"]);
  foreach ($clean as $id) {
    $url = "https://firestore.googleapis.com/v1/projects/" . $project . "/databases/(default)/documents/order/" . rawurlencode($id);
    $req = curl_init($url);
    curl_setopt_array($req, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_HTTPHEADER => ["Authorization: Bearer " . $access],
      CURLOPT_TIMEOUT => 15
    ]);
    $raw = curl_exec($req);
    $code = curl_getinfo($req, CURLINFO_HTTP_CODE);
    curl_close($req);
    if ($code !== 200) continue;
    $doc = json_decode($raw ?: "", true);
    $fields = is_array($doc["fields"] ?? null) ? $doc["fields"] : [];
    $orders[$id] = [
      "orderStatus" => field_string($fields, "orderStatus"),
      "paymentStatus" => field_string($fields, "paymentStatus"),
      "confirmedAt" => field_ms($fields, "confirmedAt"),
      "shippedAt" => field_ms($fields, "shippedAt"),
      "deliveredAt" => field_ms($fields, "deliveredAt"),
      "canceledAt" => field_ms($fields, "canceledAt")
    ];
  }
}
echo json_encode(["orders" => $orders ?: new stdClass()]);
