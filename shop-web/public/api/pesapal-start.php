<?php
header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode(["message" => "Use POST."]);
  exit;
}

$configFile = __DIR__ . "/pesapal-config.php";
if (!is_file($configFile)) {
  http_response_code(500);
  echo json_encode(["message" => "Payment is not configured."]);
  exit;
}

$config = include $configFile;
$environment = strtolower((string) ($config["environment"] ?? "sandbox"));
$base = $environment === "production"
  ? "https://pay.pesapal.com/v3"
  : "https://cybqa.pesapal.com/pesapalv3";

$body = json_decode(file_get_contents("php://input"), true);
if (!is_array($body)) {
  http_response_code(400);
  echo json_encode(["message" => "Invalid order."]);
  exit;
}

$orderId = trim((string) ($body["orderId"] ?? ""));
$amount = (int) round((float) ($body["amount"] ?? 0));
$name = trim((string) ($body["name"] ?? "Customer"));
$phone = preg_replace("/\s+/", "", (string) ($body["phone"] ?? ""));

if (!preg_match("/^FD-\d{10,15}-[a-z0-9]{3,10}$/", $orderId) || $amount < 1) {
  http_response_code(400);
  echo json_encode(["message" => "Invalid order."]);
  exit;
}

function pesapal_call($url, $token, $payload = null) {
  $ch = curl_init($url);
  $headers = ["Accept: application/json", "Content-Type: application/json"];
  if ($token !== "") {
    $headers[] = "Authorization: Bearer " . $token;
  }
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => $payload === null ? "GET" : "POST",
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_TIMEOUT => 45
  ]);
  if ($payload !== null) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
  }
  $raw = curl_exec($ch);
  $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  $data = json_decode($raw ?: "", true);
  if (!is_array($data)) {
    $data = [];
  }
  $data["_status"] = $status;
  return $data;
}

function b64url($data) {
  return rtrim(strtr(base64_encode($data), "+/", "-_"), "=");
}

function save_web_order($orderId, $amount, $name, $phone, $address, $paymentStatus, $orderStatus) {
  $file = __DIR__ . "/firestore-config.php";
  if (!is_file($file)) return;
  $key = include $file;
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
  $tokenCh = curl_init("https://oauth2.googleapis.com/token");
  curl_setopt_array($tokenCh, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ["Content-Type: application/x-www-form-urlencoded"],
    CURLOPT_POSTFIELDS => http_build_query([
      "grant_type" => "urn:ietf:params:oauth:grant-type:jwt-bearer",
      "assertion" => $header . "." . $claim . "." . b64url($signature)
    ]),
    CURLOPT_TIMEOUT => 20
  ]);
  $tokenRaw = curl_exec($tokenCh);
  curl_close($tokenCh);
  $tokenData = json_decode($tokenRaw ?: "", true);
  $access = (string) (is_array($tokenData) ? ($tokenData["access_token"] ?? "") : "");
  if ($access === "") return;
  global $body;
  $productValues = [];
  $items = is_array($body["items"] ?? null) ? $body["items"] : [];
  foreach ($items as $item) {
    if (!is_array($item)) continue;
    $productName = trim((string) ($item["name"] ?? ""));
    if ($productName === "") continue;
    $qty = max(1, (int) ($item["qty"] ?? 1));
    $productValues[] = ["mapValue" => ["fields" => [
      "quantity" => ["integerValue" => (string) $qty],
      "product" => ["mapValue" => ["fields" => [
        "id" => ["stringValue" => (string) ($item["id"] ?? "")],
        "name" => ["stringValue" => $productName]
      ]]]
    ]]];
  }
  $fields = [
    "orderId" => ["integerValue" => (string) ((int) explode("-", $orderId)[1])],
    "orderStatus" => ["stringValue" => $orderStatus],
    "paymentStatus" => ["stringValue" => $paymentStatus],
    "totalPrice" => ["integerValue" => (string) $amount],
    "customerName" => ["stringValue" => $name],
    "customerPhone" => ["stringValue" => $phone],
    "currency" => ["stringValue" => "UGX"],
    "source" => ["stringValue" => "shop-web"],
    "userId" => ["stringValue" => ""],
    "products" => ["arrayValue" => ["values" => $productValues]],
    "address" => ["mapValue" => ["fields" => [
      "address" => ["stringValue" => $address],
      "phone" => ["stringValue" => $phone]
    ]]],
    "timestamp" => ["timestampValue" => gmdate("Y-m-d\\TH:i:s\\Z")]
  ];
  $mask = "";
  foreach (array_keys($fields) as $field) {
    $mask .= ($mask === "" ? "" : "&") . "updateMask.fieldPaths=" . rawurlencode($field);
  }
  $url = "https://firestore.googleapis.com/v1/projects/" . rawurlencode($key["project_id"]) . "/databases/(default)/documents/order/" . rawurlencode($orderId) . "?" . $mask;
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => "PATCH",
    CURLOPT_HTTPHEADER => ["Authorization: Bearer " . $access, "Content-Type: application/json"],
    CURLOPT_POSTFIELDS => json_encode(["fields" => $fields]),
    CURLOPT_TIMEOUT => 20
  ]);
  curl_exec($ch);
  curl_close($ch);
}

function pesapal_fail($data, $fallback) {
  global $orderId, $amount, $name, $phone, $body;
  save_web_order($orderId, $amount, $name, $phone, (string) ($body["address"] ?? ""), "failed", "Failed");
  $message = $data["error"]["message"] ?? $data["message"] ?? $fallback;
  if ($message === "" || $message === "fetch failed") {
    $message = "Could not reach Pesapal. Try again.";
  }
  http_response_code(502);
  echo json_encode(["message" => $message]);
  exit;
}

save_web_order($orderId, $amount, $name, $phone, (string) ($body["address"] ?? ""), "pending_payment", "Pending");

$tokenData = pesapal_call($base . "/api/Auth/RequestToken", "", [
  "consumer_key" => (string) ($config["consumer_key"] ?? ""),
  "consumer_secret" => (string) ($config["consumer_secret"] ?? "")
]);
$token = (string) ($tokenData["token"] ?? "");
if ($token === "") {
  pesapal_fail($tokenData, "Pesapal did not sign in.");
}

$list = pesapal_call($base . "/api/URLSetup/GetIpnList", $token);
$existing = [];
if (isset($list[0]) && is_array($list[0])) {
  $existing = $list[0];
} elseif (isset($list["ipn_list"][0]) && is_array($list["ipn_list"][0])) {
  $existing = $list["ipn_list"][0];
}
$ipnId = (string) ($existing["ipn_id"] ?? $existing["ipnId"] ?? "");
if ($ipnId === "") {
  $registered = pesapal_call($base . "/api/URLSetup/RegisterIPN", $token, [
    "url" => "https://fancydealsug.com/pesapal-ipn",
    "ipn_notification_type" => "GET"
  ]);
  $ipnId = (string) ($registered["ipn_id"] ?? "");
}
if ($ipnId === "") {
  pesapal_fail($list, "Pesapal did not accept the notification address.");
}

$parts = preg_split("/\s+/", $name, -1, PREG_SPLIT_NO_EMPTY);
$first = $parts[0] ?? "Customer";
$last = count($parts) > 1 ? implode(" ", array_slice($parts, 1)) : "Deals";

$submitted = pesapal_call($base . "/api/Transactions/SubmitOrderRequest", $token, [
  "id" => $orderId,
  "currency" => "UGX",
  "amount" => $amount,
  "description" => "Fancy Deals " . $orderId,
  "callback_url" => "https://fancydealsug.com/",
  "notification_id" => $ipnId,
  "billing_address" => [
    "email_address" => "orders@fancydealsug.com",
    "phone_number" => $phone !== "" ? $phone : "0700000000",
    "country_code" => "UG",
    "first_name" => $first,
    "last_name" => $last
  ]
]);

$redirect = (string) ($submitted["redirect_url"] ?? "");
if ($redirect === "") {
  pesapal_fail($submitted, "Pesapal did not return a payment page.");
}

echo json_encode(["redirectUrl" => $redirect]);
