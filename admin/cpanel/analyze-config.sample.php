<?php
/**
 * Copy this file to analyze-config.php on the server (same folder as analyze-product.php).
 * Do not commit analyze-config.php — it contains your secret key.
 */
return [
  'OPENROUTER_API_KEY' => 'sk-or-v1-PASTE-YOUR-KEY-HERE',
  // Firebase web API key (same as PUBLIC_FIREBASE_API_KEY): used to check the admin's sign-in.
  'FIREBASE_WEB_API_KEY' => 'PASTE-PUBLIC_FIREBASE_API_KEY-HERE',
  // Optional:
  // 'OPENROUTER_VISION_MODEL' => 'google/gemini-2.5-flash',
];
