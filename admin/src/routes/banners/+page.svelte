<script lang="ts">
  import { onMount } from "svelte";
  import { doc, getDoc, setDoc } from "firebase/firestore";
  import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
  import { httpsCallable } from "firebase/functions";
  import { getFunctions } from "firebase/functions";
  import { db, storage, app } from "$lib/firebase";

  let banners: any[] = [];
  let loading = true;
  let uploading = false;
  let errorMsg = "";
  let successMsg = "";

  // Form State
  let files: FileList | null = null;
  let caption = "";
  let generatingCaption = false;

  async function handleGenerateCaption() {
    if (!files || files.length === 0) {
      errorMsg = "Please select an image first before generating a caption.";
      return;
    }

    generatingCaption = true;
    errorMsg = "";
    
    try {
      const file = files[0];
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        try {
          const base64data = reader.result;
          const functions = getFunctions(app);
          const adminGenerateCaption = httpsCallable(functions, 'adminGenerateCaption');
          const result: any = await adminGenerateCaption({ imageBase64: base64data });
          
          if (result.data.caption) {
            caption = result.data.caption;
          }
        } catch (err: any) {
          errorMsg = "AI Error: " + err.message;
        } finally {
          generatingCaption = false;
        }
      };
      
      reader.readAsDataURL(file);
    } catch (err: any) {
      errorMsg = "Failed to generate caption: " + err.message;
      generatingCaption = false;
    }
  }

  onMount(async () => {
    await loadBanners();
  });

  async function loadBanners() {
    try {
      const docRef = doc(db, "settings", "banners");
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        banners = snapshot.data().items || [];
      } else {
        await setDoc(docRef, { items: [] });
      }
    } catch (e: any) {
      errorMsg = "Error loading banners: " + e.message;
    } finally {
      loading = false;
    }
  }

  async function handleAddBanner() {
    if (!files || files.length === 0) {
      errorMsg = "Please select an image.";
      return;
    }

    const file = files[0];

    // Client-side validations
    if (file.size > 20 * 1024 * 1024) {
      errorMsg = "Image size exceeds the 20MB limit. Please compress or resize the image.";
      return;
    }

    if (!file.type.startsWith("image/")) {
      errorMsg = "Invalid file type. Please select a valid image file.";
      return;
    }

    uploading = true;
    errorMsg = "";
    successMsg = "";

    try {
      const imageId = crypto.randomUUID();
      const fileRef = ref(storage, `banners/${imageId}`);
      await uploadBytes(fileRef, file, {
        contentType: file.type || "image/jpeg"
      });
      const downloadUrl = await getDownloadURL(fileRef);

      const newBanner = {
        id: imageId,
        imageUrl: downloadUrl,
        caption: caption
      };

      const updatedBanners = [...banners, newBanner];
      
      await setDoc(doc(db, "settings", "banners"), { items: updatedBanners }, { merge: true });
      
      banners = updatedBanners;
      
      // Reset form
      caption = "";
      files = null;
      successMsg = "Banner added successfully!";
      
    } catch (e: any) {
      errorMsg = "Failed to upload banner: " + e.message;
    } finally {
      uploading = false;
    }
  }

  async function handleDeleteBanner(index: number) {
    if (!confirm("Are you sure you want to delete this banner?")) return;
    
    try {
      const bannerToDelete = banners[index];
      
      // Try to delete from storage
      try {
        const imageRef = ref(storage, bannerToDelete.imageUrl);
        await deleteObject(imageRef);
      } catch (err) {
        console.error("Could not delete image from storage", err);
      }

      // Update Firestore
      const updatedBanners = banners.filter((_, i) => i !== index);
      await setDoc(doc(db, "settings", "banners"), { items: updatedBanners }, { merge: true });
      
      banners = updatedBanners;
      successMsg = "Banner deleted.";
    } catch (e: any) {
      errorMsg = "Failed to delete banner: " + e.message;
    }
  }
</script>

<div class="header">
  <h1>Manage Home Banners</h1>
  <a href="/" class="back-link">← Back to Dashboard</a>
</div>

<p>Upload promotional images, models, or sales banners that appear in the top carousel on the mobile app home screen.</p>

{#if loading}
  <p>Loading...</p>
{:else}
  {#if errorMsg}
    <div class="alert error">{errorMsg}</div>
  {/if}
  {#if successMsg}
    <div class="alert success">{successMsg}</div>
  {/if}

  <div class="form-container">
    <h3>Add New Banner</h3>
    <form on:submit|preventDefault={handleAddBanner}>
      <label>
        Banner Image (Required)
        <input type="file" bind:files accept="image/*" required />
      </label>
      
      <label>
        Caption / Promotion Text
        <div class="caption-input-group">
          <input type="text" bind:value={caption} placeholder="e.g. Special Collection 2026" required />
          <button type="button" class="ai-btn" on:click={handleGenerateCaption} disabled={generatingCaption}>
            {generatingCaption ? '✨ Analyzing...' : '✨ Auto-Generate'}
          </button>
        </div>
      </label>
      
      <button type="submit" disabled={uploading}>
        {uploading ? 'Uploading...' : 'Add Banner'}
      </button>
    </form>
  </div>

  <h3>Current Banners</h3>
  {#if banners.length === 0}
    <p>No banners added yet.</p>
  {:else}
    <div class="banners-grid">
      {#each banners as banner, index}
        <div class="banner-card">
          <div class="img-container">
            <img src={banner.imageUrl} alt={banner.caption} />
          </div>
          <div class="caption">
            <strong>Caption:</strong> {banner.caption}
          </div>
          <button class="delete-btn" on:click={() => handleDeleteBanner(index)}>Delete</button>
        </div>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  .back-link { color: #f97316; text-decoration: none; }
  .alert { padding: 12px; border-radius: 4px; margin-bottom: 20px; }
  .error { background: #ffebee; color: #c62828; }
  .success { background: #e8f5e9; color: #2e7d32; }

  .form-container {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #dee2e6;
    margin-bottom: 30px;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 15px;
    max-width: 500px;
  }
  
  label {
    display: flex;
    flex-direction: column;
    font-weight: 500;
  }

  input[type="text"], input[type="file"] {
    padding: 8px;
    margin-top: 5px;
    border: 1px solid #ccc;
    border-radius: 4px;
    flex-grow: 1;
  }

  .caption-input-group {
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
  }

  .ai-btn {
    background: #6c5ce7;
    margin-top: 5px;
    white-space: nowrap;
  }

  button {
    padding: 10px 20px;
    background: #f97316;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .banners-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
  }

  .banner-card {
    border: 1px solid #dee2e6;
    border-radius: 8px;
    overflow: hidden;
    background: white;
    display: flex;
    flex-direction: column;
  }

  .img-container {
    width: 100%;
    height: 180px;
    background: #e9ecef;
  }

  .img-container img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .caption {
    padding: 15px;
    font-size: 14px;
    flex-grow: 1;
  }

  .delete-btn {
    background: #dc3545;
    margin: 10px 15px 15px;
    padding: 8px;
  }
</style>
