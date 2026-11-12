<script lang="ts">
  import { page } from "$app/stores";
</script>

<div class="error-page">
  <h1>Something went wrong</h1>
  <p>{$page.error?.message ?? "Unknown error"}</p>
  <a href="/login">Go to login</a>
</div>

<style>
  .error-page {
    max-width: 560px;
    margin: 48px auto;
    padding: 24px;
    font-family: system-ui, sans-serif;
  }
</style>
