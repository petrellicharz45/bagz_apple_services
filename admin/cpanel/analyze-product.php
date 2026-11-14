<?php
/**
 * Bagz admin — AI product auto-fill (no Firebase Blaze / Cloud Functions).
 * Place next to index.html on admin hosting. Requires analyze-config.php.
 */
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  header('Access-Control-Allow-Methods: POST, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type');
  http_response_code(204);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['error' => 'POST only']);
  exit;
}

$configPath = __DIR__ . '/analyze-config.php';
if (!is_readable($configPath)) {
  http_response_code(500);
  echo json_encode([
    'error' => 'Missing analyze-config.php. Copy analyze-config.sample.php to analyze-config.php and add OPENROUTER_API_KEY.'
  ]);
  exit;
}

$config = require $configPath;

// Only signed-in Bagz admins may use this (it spends OpenRouter credit). The admin sends its
// Firebase ID token; Google's accounts:lookup confirms it and returns the user's custom claims.
$firebaseKey = trim((string) ($config['FIREBASE_WEB_API_KEY'] ?? ''));
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
$idToken = preg_match('/^Bearer\s+(\S+)$/', $authHeader, $m) ? $m[1] : '';
if ($firebaseKey === '' || $idToken === '') {
  http_response_code(401);
  echo json_encode(['error' => 'Sign in to the admin to use AI auto-fill.']);
  exit;
}
$lookup = curl_init('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' . urlencode($firebaseKey));
curl_setopt_array($lookup, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode(['idToken' => $idToken]),
  CURLOPT_TIMEOUT => 15,
]);
$lookupRaw = curl_exec($lookup);
$lookupCode = curl_getinfo($lookup, CURLINFO_HTTP_CODE);
curl_close($lookup);
$lookupData = json_decode((string) $lookupRaw, true);
$claims = json_decode((string) ($lookupData['users'][0]['customAttributes'] ?? '{}'), true);
if ($lookupCode !== 200 || empty($claims['admin'])) {
  http_response_code(403);
  echo json_encode(['error' => 'Only Bagz admins can use AI auto-fill. Sign out and in again if you were just made an admin.']);
  exit;
}

$key = trim((string) ($config['OPENROUTER_API_KEY'] ?? ''));
$model = trim((string) ($config['OPENROUTER_VISION_MODEL'] ?? ''));
if ($model === '') {
  $model = 'google/gemini-2.5-flash';
}

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) {
  http_response_code(400);
  echo json_encode(['error' => 'Invalid JSON body']);
  exit;
}

$imageBase64 = isset($body['imageBase64']) ? (string) $body['imageBase64'] : '';
$productName = isset($body['productName']) ? (string) $body['productName'] : '';
$category = isset($body['category']) ? (string) $body['category'] : '';
$categories = isset($body['categories']) && is_array($body['categories'])
  ? array_map('strval', $body['categories'])
  : [];

if ($imageBase64 === '' || strpos($imageBase64, 'data:image') !== 0) {
  http_response_code(400);
  echo json_encode(['error' => 'Missing or invalid imageBase64']);
  exit;
}

if ($key === '') {
  http_response_code(500);
  echo json_encode(['error' => 'OPENROUTER_API_KEY is empty in analyze-config.php']);
  exit;
}

$categoryList = count($categories) > 0
  ? implode('", "', $categories)
  : 'iPhones, Google Pixel, Samsung, MacBooks & iPads, Apple Watch, Audio, Accessories';

$nameHint = $productName !== ''
  ? ". The admin typed the exact model: \"{$productName}\". Use it as the name and do NOT change the model, generation or storage."
  : '. If you cannot read the exact model from the photo, use a generic name such as "Apple iPhone (Pro model)" - never guess a model number or year.';
$catHint = $category !== '' ? " (hint: {$category})" : '';

$prompt = <<<PROMPT
You are an e-commerce copywriter for Bagz Apple Services, an authentic Apple & tech store in Kampala, Uganda.
Look at the product image and return ONLY one JSON object with these keys:
- "name": short product title (max 10 words){$nameHint}
- "category": exactly ONE from: {$categoryList}{$catHint}
- "description": 2-3 sentences about what is visible (design, colour/finish, camera layout, what is in the box) and who it suits. Only mention a chip, storage size, battery or other spec if it is part of the product name given above; never guess specs, model years, prices or warranty terms
- "colors": array of 2-4 dominant HEX colors like "#FF5733"

Example: {"name":"iPhone 17 Pro Max 256GB Cosmic Orange","category":"iPhones","description":"...","colors":["#1E3A5F","#FFFFFF"]}
PROMPT;

$payload = json_encode([
  'model' => $model,
  'messages' => [
    [
      'role' => 'user',
      'content' => [
        ['type' => 'text', 'text' => $prompt],
        ['type' => 'image_url', 'image_url' => ['url' => $imageBase64]],
      ],
    ],
  ],
  'max_tokens' => 512,
]);

$ch = curl_init('https://openrouter.ai/api/v1/chat/completions');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    'Authorization: Bearer ' . $key,
    'Content-Type: application/json',
    'HTTP-Referer: https://admin.quontrova.com',
    'X-Title: Bagz Admin',
  ],
  CURLOPT_POSTFIELDS => $payload,
  CURLOPT_TIMEOUT => 55,
]);

$response = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if ($response === false) {
  http_response_code(502);
  echo json_encode(['error' => 'OpenRouter request failed: ' . $curlErr]);
  exit;
}

if ($status < 200 || $status >= 300) {
  http_response_code(502);
  echo json_encode(['error' => 'OpenRouter HTTP ' . $status . ': ' . substr($response, 0, 200)]);
  exit;
}

$data = json_decode($response, true);
$content = $data['choices'][0]['message']['content'] ?? null;
if (!is_string($content) || $content === '') {
  http_response_code(502);
  echo json_encode(['error' => 'Empty AI response']);
  exit;
}

$cleaned = trim($content);
if (str_starts_with($cleaned, '```json')) {
  $cleaned = trim(preg_replace('/^```json|```$/m', '', $cleaned));
} elseif (str_starts_with($cleaned, '```')) {
  $cleaned = trim(preg_replace('/^```|```$/m', '', $cleaned));
}

$parsed = json_decode($cleaned, true);
if (!is_array($parsed) && preg_match('/\{[\s\S]*\}/', $cleaned, $m)) {
  $parsed = json_decode($m[0], true);
}
if (!is_array($parsed)) {
  http_response_code(502);
  echo json_encode(['error' => 'AI returned invalid JSON']);
  exit;
}

echo json_encode([
  'name' => $parsed['name'] ?? $productName,
  'category' => $parsed['category'] ?? $category,
  'description' => $parsed['description'] ?? '',
  'colors' => is_array($parsed['colors'] ?? null) ? $parsed['colors'] : [],
]);
