<?php
require __DIR__ . "/app-cors.php";
header("Content-Type: application/json");
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode(["message" => "Use POST."]);
  exit;
}
$body = json_decode(file_get_contents("php://input"), true);
$message = trim((string) ($body["message"] ?? ""));
if (strlen($message) < 5) {
  http_response_code(400);
  echo json_encode(["message" => "Write what is wrong with this product."]);
  exit;
}
$file = __DIR__ . "/firestore-config.php";
if (!is_file($file)) {
  http_response_code(500);
  echo json_encode(["message" => "Reports are not configured."]);
  exit;
}
$key = include $file;
function b64url($data) {
  return rtrim(strtr(base64_encode($data), "+/", "-_"), "=");
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
$token = json_decode($tokenRaw ?: "", true);
$access = is_array($token) ? (string) ($token["access_token"] ?? "") : "";
if ($access === "") {
  http_response_code(502);
  echo json_encode(["message" => "Could not save the report."]);
  exit;
}
$id = "R" . (string) round(microtime(true) * 1000);
$fields = [
  "productId" => ["stringValue" => (string) ($body["productId"] ?? "")],
  "productName" => ["stringValue" => substr((string) ($body["productName"] ?? ""), 0, 300)],
  "message" => ["stringValue" => substr($message, 0, 2000)],
  "createdAt" => ["timestampValue" => gmdate("Y-m-d\\TH:i:s\\Z")]
];
$save = curl_init("https://firestore.googleapis.com/v1/projects/" . rawurlencode($key["project_id"]) . "/databases/(default)/documents/productReport?documentId=" . rawurlencode($id));
curl_setopt_array($save, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ["Authorization: Bearer " . $access, "Content-Type: application/json"],
  CURLOPT_POSTFIELDS => json_encode(["fields" => $fields]),
  CURLOPT_TIMEOUT => 20
]);
curl_exec($save);
$status = (int) curl_getinfo($save, CURLINFO_HTTP_CODE);
curl_close($save);
if ($status < 200 || $status >= 300) {
  http_response_code(502);
  echo json_encode(["message" => "Could not save the report."]);
  exit;
}
echo json_encode(["ok" => true]);
