<?php
// Lets the Bagz Android app (which serves the shop from https://appassets.androidplatform.net)
// call these endpoints on bagzappleservices.com.
$bagzAppOrigin = "https://appassets.androidplatform.net";
if (($_SERVER["HTTP_ORIGIN"] ?? "") === $bagzAppOrigin) {
  header("Access-Control-Allow-Origin: " . $bagzAppOrigin);
  header("Access-Control-Allow-Methods: POST, OPTIONS");
  header("Access-Control-Allow-Headers: Content-Type");
  header("Access-Control-Max-Age: 86400");
  header("Vary: Origin");
}
if (($_SERVER["REQUEST_METHOD"] ?? "") === "OPTIONS") {
  http_response_code(204);
  exit;
}
