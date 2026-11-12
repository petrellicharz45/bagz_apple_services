<script lang="ts">
  import { onMount } from "svelte";
  import {
    collection,
    deleteField,
    doc,
    getDoc,
    getDocs,
    query,
    setDoc,
    updateDoc,
    where,
    writeBatch
  } from "firebase/firestore";
  import { db } from "$lib/firebase";
  import { uploadProductImage } from "$lib/images/cloudinaryUpload";
  import { resizeToJpeg } from "$lib/images/productImage";

  /** Category bubbles are small: resize, then upload to Cloudinary (same as product photos). */
  async function uploadCategoryImage(file: File, category: string): Promise<string> {
    const jpeg = await resizeToJpeg(file, 600, 0.8);
    const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return uploadProductImage(jpeg, `${slug}_${crypto.randomUUID()}`, "category_images");
  }

  let categoriesList = ["Clothing", "Shoes", "Accessories", "Bags", "Jewelry"];
  
  let categoryImages: Record<string, string> = {
    Clothing: "https://i.pinimg.com/736x/80/f7/32/80f7324d57c2e391b480b544b62dbba4.jpg",
    Shoes: "https://i.pinimg.com/736x/6f/a6/cf/6fa6cf5c363d67f52ca8c919d77f80db.jpg",
    Accessories: "https://i.pinimg.com/564x/0f/7d/5d/0f7d5deba4ec60155b5d122247fb7eec.jpg",
    Bags: "https://images.unsplash.com/photo-1584916201218-f4242ceb4809?q=80&w=400&auto=format&fit=crop",
    Jewelry: "https://images.unsplash.com/photo-1599643478524-fb66f7f2b1d6?q=80&w=400&auto=format&fit=crop"
  };

  let loading = true;
  let uploadingCategory = "";
  /** Categories whose saved image URL fails to load (e.g. old Storage links). */
  let brokenImages: Record<string, boolean> = {};
  let errorMsg = "";
  let successMsg = "";

  let newCategoryName = "";
  let addingCategory = false;

  onMount(async () => {
    try {
      const docRef = doc(db, "settings", "categories");
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        // Use ONLY Firestore data — ignore hardcoded defaults
        categoryImages = data as Record<string, string>;
        categoriesList = Object.keys(categoryImages);
      } else {
        // Create the default document if it doesn't exist
        await setDoc(docRef, categoryImages);
      }
    } catch (e: any) {
      errorMsg = "Error loading categories: " + e.message;
    } finally {
      loading = false;
    }
  });

  async function handleFileChange(event: Event, category: string) {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;

    const file = target.files[0];
    uploadingCategory = category;
    errorMsg = "";
    successMsg = "";

    try {
      const downloadUrl = await uploadCategoryImage(file, category);

      // Update local state
      categoryImages[category] = downloadUrl;
      brokenImages = { ...brokenImages, [category]: false };

      // Save new URLs back to Firestore
      const docRef = doc(db, "settings", "categories");
      await setDoc(docRef, categoryImages, { merge: true });

      successMsg = `Successfully updated image for ${category}!`;
    } catch (e: any) {
      errorMsg = "Failed to upload image: " + e.message;
    } finally {
      uploadingCategory = "";
      target.value = ""; // Reset input
    }
  }

  let newCategoryFile: File | null = null;
  let newCategoryFileInput: HTMLInputElement;

  function handleNewCategoryFilePick(event: Event) {
    const target = event.target as HTMLInputElement;
    newCategoryFile = target.files?.[0] ?? null;
  }

  async function addCategory() {
    const category = newCategoryName.trim();
    if (!category) {
      errorMsg = "Enter a category name first.";
      return;
    }

    // Check if category already exists (case-insensitive check)
    const existing = categoriesList.find(c => c.toLowerCase() === category.toLowerCase());
    if (existing) {
      errorMsg = `Category "${category}" already exists!`;
      return;
    }

    addingCategory = true;
    errorMsg = "";
    successMsg = "";

    try {
      // Photo is optional — the shop falls back to a product photo until one is uploaded.
      const downloadUrl = newCategoryFile ? await uploadCategoryImage(newCategoryFile, category) : "";

      const docRef = doc(db, "settings", "categories");
      await setDoc(docRef, { [category]: downloadUrl }, { merge: true });

      // Update local state
      categoryImages = { ...categoryImages, [category]: downloadUrl };
      categoriesList = [...categoriesList, category];

      successMsg = `Successfully added category "${category}"!`;
      newCategoryName = "";
      newCategoryFile = null;
      if (newCategoryFileInput) newCategoryFileInput.value = "";
    } catch (e: any) {
      errorMsg = "Failed to add category: " + e.message;
    } finally {
      addingCategory = false;
    }
  }

  let renamingCategory = "";
  let renameValue = "";

  async function startRename(category: string) {
    renamingCategory = category;
    renameValue = category;
  }

  function cancelRename() {
    renamingCategory = "";
    renameValue = "";
  }

  async function confirmRename(oldName: string) {
    const newName = renameValue.trim();
    if (!newName) {
      errorMsg = "Category name cannot be empty.";
      return;
    }
    if (newName === oldName) {
      cancelRename();
      return;
    }

    const existing = categoriesList.find(c => c.toLowerCase() === newName.toLowerCase());
    if (existing) {
      errorMsg = `Category "${newName}" already exists!`;
      return;
    }

    errorMsg = "";
    successMsg = "";

    try {
      // Rename in place so the category keeps its position in the list.
      const docRef = doc(db, "settings", "categories");
      const snapshot = await getDoc(docRef);
      const current = (snapshot.exists() ? snapshot.data() : categoryImages) as Record<string, string>;
      const renamed: Record<string, string> = {};
      for (const [key, url] of Object.entries(current)) {
        renamed[key === oldName ? newName : key] = url;
      }
      await setDoc(docRef, renamed);
      categoryImages = renamed;
      categoriesList = Object.keys(categoryImages);

      // Keep its subcategories and products attached to the new name.
      const subRef = doc(db, "settings", "subcategories");
      const subSnap = await getDoc(subRef);
      const subs = subSnap.exists() ? subSnap.data() : {};
      if (oldName in subs) {
        await updateDoc(subRef, { [newName]: subs[oldName], [oldName]: deleteField() });
      }
      const products = await getDocs(query(collection(db, "product"), where("category", "==", oldName)));
      for (let i = 0; i < products.docs.length; i += 400) {
        const batch = writeBatch(db);
        for (const p of products.docs.slice(i, i + 400)) batch.update(p.ref, { category: newName });
        await batch.commit();
      }

      successMsg = `Renamed "${oldName}" to "${newName}" (${products.size} product${products.size === 1 ? "" : "s"} moved).`;
      cancelRename();
    } catch (e: any) {
      errorMsg = "Failed to rename category: " + e.message;
    }
  }

  async function deleteCategory(categoryName: string) {
    const confirmed = window.confirm(`Are you sure you want to delete the "${categoryName}" category? This action cannot be undone.`);
    if (!confirmed) return;

    errorMsg = "";
    successMsg = "";

    try {
      const docRef = doc(db, "settings", "categories");
      await updateDoc(docRef, { [categoryName]: deleteField() });
      const { [categoryName]: _removed, ...rest } = categoryImages;
      categoryImages = rest;
      categoriesList = Object.keys(categoryImages);

      successMsg = `Successfully deleted category "${categoryName}"!`;
    } catch (e: any) {
      errorMsg = "Failed to delete category: " + e.message;
    }
  }
</script>

<div class="header">
  <h1>Manage Category Images</h1>
  <a href="/" class="back-link">← Back to Dashboard</a>
</div>

<p>Update the images that appear in the circular category bubbles on the mobile app home screen.</p>

{#if !loading}
  <div class="add-category-card">
    <h3>Add New Category</h3>
    <div class="form-row">
      <input
        type="text"
        bind:value={newCategoryName}
        placeholder="Enter new category name (e.g. Outerwear)"
        disabled={addingCategory}
        on:keydown={(e) => { if (e.key === 'Enter') addCategory(); }}
      />
    </div>
    <div class="form-row" style="margin-top: 10px;">
      <label class="pick-btn">
        {newCategoryFile ? 'Change photo' : 'Choose photo (optional)'}
        <input
          type="file"
          accept="image/*"
          bind:this={newCategoryFileInput}
          on:change={handleNewCategoryFilePick}
          disabled={addingCategory}
        />
      </label>
      <span class="file-name">{newCategoryFile ? newCategoryFile.name : 'No photo chosen'}</span>
      <button
        class="add-btn"
        on:click={addCategory}
        disabled={addingCategory || !newCategoryName.trim()}
      >
        {addingCategory ? 'Adding...' : 'Add Category'}
      </button>
    </div>
    {#if addingCategory}
      <div class="status-text">{newCategoryFile ? 'Uploading photo and creating category...' : 'Creating category...'}</div>
    {/if}
  </div>
{/if}

{#if loading}
  <p>Loading...</p>
{:else}
  {#if errorMsg}
    <div class="alert error">{errorMsg}</div>
  {/if}
  {#if successMsg}
    <div class="alert success">{successMsg}</div>
  {/if}

  <div class="categories-grid">
    {#each categoriesList as category}
      <div class="category-card">
        {#if renamingCategory === category}
          <div class="rename-row">
            <input
              type="text"
              bind:value={renameValue}
              on:keydown={(e) => { if (e.key === 'Enter') confirmRename(category); if (e.key === 'Escape') cancelRename(); }}
              placeholder="New name..."
            />
            <button class="rename-confirm-btn" on:click={() => confirmRename(category)}>✓</button>
            <button class="rename-cancel-btn" on:click={cancelRename}>✕</button>
          </div>
        {:else}
          <h3>{category}</h3>
        {/if}
        <div class="img-preview">
          {#if categoryImages[category] && !brokenImages[category]}
            <img
              src={categoryImages[category]}
              alt={category}
              on:error={() => (brokenImages = { ...brokenImages, [category]: true })}
            />
          {:else}
            <div class="no-photo">{categoryImages[category] ? 'Photo missing — upload again' : 'No photo yet'}</div>
          {/if}
          {#if uploadingCategory === category}
            <div class="overlay">Uploading...</div>
          {/if}
        </div>
        
        <label class="upload-btn">
          Upload New Image
          <input 
            type="file" 
            accept="image/*" 
            on:change={(e) => handleFileChange(e, category)} 
            disabled={uploadingCategory === category}
          />
        </label>
        <div class="card-actions">
          {#if renamingCategory !== category}
            <button class="rename-btn" on:click={() => startRename(category)}>
              Rename
            </button>
          {/if}
          <button class="delete-btn" on:click={() => deleteCategory(category)}>
            Delete
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  .back-link {
    color: #1673c4;
    text-decoration: none;
  }
  .alert {
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 20px;
  }
  .error { background: #ffebee; color: #c62828; }
  .success { background: #e8f5e9; color: #2e7d32; }

  .categories-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;
    margin-top: 20px;
  }

  .category-card {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    padding: 15px;
    border-radius: 8px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .img-preview {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    overflow: hidden;
    margin: 15px auto;
    border: 2px solid #ccc;
    position: relative;
    background: #fff;
  }

  .img-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }

  .upload-btn {
    display: inline-block;
    padding: 8px 16px;
    background: #1673c4;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    margin-top: auto;
    font-size: 14px;
    transition: opacity 0.2s;
  }
  
  .upload-btn:hover {
    opacity: 0.9;
  }

  .upload-btn input[type="file"] {
    display: none;
  }

  .add-category-card {
    background: #fff;
    border: 1px solid #dee2e6;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 30px;
    max-width: 500px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }
  .add-category-card h3 {
    margin-top: 0;
    margin-bottom: 12px;
    font-size: 16px;
    color: #1b1512;
  }
  .form-row {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .add-category-card input[type="text"] {
    flex: 1;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
  }
  .add-category-card input[type="text"]:focus {
    border-color: #1673c4;
    outline: none;
  }
  .no-photo {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px;
    font-size: 12px;
    color: #6c757d;
    background: #f1f3f5;
  }
  .pick-btn {
    padding: 8px 14px;
    border: 1px dashed #1673c4;
    color: #1673c4;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    white-space: nowrap;
  }
  .pick-btn input[type="file"] {
    display: none;
  }
  .file-name {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    color: #6c757d;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .add-btn {
    padding: 9px 18px;
    background: #1673c4;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    white-space: nowrap;
  }
  .add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .status-text {
    margin-top: 8px;
    font-size: 12px;
    color: #6c757d;
  }

  .card-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .rename-btn {
    display: inline-block;
    padding: 6px 14px;
    background: #6c5ce7;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    transition: opacity 0.2s;
  }
  .rename-btn:hover {
    opacity: 0.85;
  }

  .rename-row {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 4px;
  }
  .rename-row input {
    flex: 1;
    padding: 6px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
  }
  .rename-row input:focus {
    border-color: #1673c4;
    outline: none;
  }
  .rename-confirm-btn {
    background: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 14px;
  }
  .rename-cancel-btn {
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 14px;
  }

  .delete-btn {
    display: inline-block;
    padding: 6px 14px;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    transition: opacity 0.2s;
  }
  .delete-btn:hover {
    opacity: 0.85;
  }
</style>
