<script lang="ts">
  import { onMount } from "svelte";
  import { doc, getDoc, setDoc } from "firebase/firestore";
  import { getFunctions, httpsCallable } from "firebase/functions";
  import { db, app } from "$lib/firebase";
  import { uploadProductImage } from "$lib/images/cloudinaryUpload";
  import { resizeToJpeg } from "$lib/images/productImage";

  /** Subcategory bubbles are small: resize, then upload to Cloudinary (same as product photos). */
  async function uploadSubcategoryImage(file: File, category: string, subName: string): Promise<string> {
    const jpeg = await resizeToJpeg(file, 600, 0.8);
    const slug = `${category}_${subName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return uploadProductImage(jpeg, `${slug}_${crypto.randomUUID()}`, "subcategories");
  }

  let mainCategories: string[] = [];
  let selectedCategory = "";
  
  let subcategoriesMap: Record<string, any[]> = {};
  
  let loading = true;
  let errorMsg = "";
  let successMsg = "";
  
  let newSubName = "";
  let adding = false;
  
  let editingIndex = -1;
  let editingName = "";
  let editingCategory = "";
  let updatingImage = false;

  onMount(async () => {
    try {
      const docRef = doc(db, "settings", "subcategories");
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        subcategoriesMap = snapshot.data() as Record<string, any[]>;
      } else {
        await setDoc(docRef, {});
      }
      
      // Fetch dynamic categories
      const catRef = doc(db, "settings", "categories");
      const catSnap = await getDoc(catRef);
      if (catSnap.exists() && catSnap.data()) {
         const keys = Object.keys(catSnap.data());
         // Filter out standard ones if you want, but for now just use all or keep static ones at the top
         const staticCats = ["Just for You", "New In", "Sale"];
         const dynamicCats = keys.filter(k => !staticCats.includes(k));
         mainCategories = [...staticCats, ...dynamicCats];
      } else {
         mainCategories = ["Just for You", "New In", "Sale", "Clothing", "Shoes", "Accessories", "Bags", "Jewelry"];
      }
      
      if (mainCategories.length > 0) {
        selectedCategory = mainCategories[0];
      }

      mainCategories.forEach(cat => {
        if (!subcategoriesMap[cat]) subcategoriesMap[cat] = [];
      });
    } catch (e: any) {
      errorMsg = "Error loading subcategories: " + e.message;
    } finally {
      loading = false;
    }
  });

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

  async function handleAutoUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;

    const file = target.files[0];
    adding = true;
    errorMsg = "";
    successMsg = "AI is analyzing your image...";

    try {
      let mainCategory = selectedCategory;
      let subcategoryName = "";
      try {
        const base64 = await fileToBase64(file);
        const functions = getFunctions(app!);
        const categorizeFn = httpsCallable(functions, "adminCategorizeSubcategoryImage");
        const result = await categorizeFn({ imageBase64: base64 });
        ({ mainCategory, subcategoryName } = result.data as any);
        successMsg = `AI chose ${mainCategory} > ${subcategoryName}. Uploading...`;
      } catch {
        // AI function unavailable — ask for the name and use the selected category.
        const guess = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
        subcategoryName = (window.prompt(`Name for this subcategory in ${selectedCategory}:`, guess) || "").trim();
        if (!subcategoryName) {
          successMsg = "";
          return;
        }
        successMsg = `Adding ${subcategoryName} to ${selectedCategory}. Uploading...`;
      }

      const validCategory = mainCategories.includes(mainCategory) ? mainCategory : selectedCategory;
      const downloadUrl = await uploadSubcategoryImage(file, validCategory, subcategoryName);

      const newItem = { name: subcategoryName, imageUrl: downloadUrl };
      
      if (!subcategoriesMap[validCategory]) {
        subcategoriesMap[validCategory] = [];
      }
      subcategoriesMap[validCategory] = [...subcategoriesMap[validCategory], newItem];

      const docRef = doc(db, "settings", "subcategories");
      await setDoc(docRef, subcategoriesMap, { merge: true });

      selectedCategory = validCategory;
      successMsg = `Successfully added ${subcategoryName} to ${validCategory}!`;
    } catch (e: any) {
      errorMsg = "Failed: " + e.message;
      successMsg = "";
    } finally {
      adding = false;
      target.value = "";
    }
  }

  async function deleteSubcategory(index: number) {
    if (!confirm("Remove this subcategory?")) return;
    
    subcategoriesMap[selectedCategory].splice(index, 1);
    subcategoriesMap = { ...subcategoriesMap };
    
    try {
      const docRef = doc(db, "settings", "subcategories");
      await setDoc(docRef, subcategoriesMap, { merge: true });
      successMsg = "Removed subcategory.";
    } catch (e: any) {
      errorMsg = "Failed to remove: " + e.message;
    }
  }

  function startEdit(index: number) {
    editingIndex = index;
    editingName = subcategoriesMap[selectedCategory][index].name;
    editingCategory = selectedCategory;
  }

  async function saveEdit() {
    if (!editingName.trim()) return;
    
    const subcat = subcategoriesMap[selectedCategory][editingIndex];
    subcat.name = editingName.trim();
    
    if (editingCategory !== selectedCategory) {
      subcategoriesMap[selectedCategory].splice(editingIndex, 1);
      if (!subcategoriesMap[editingCategory]) {
        subcategoriesMap[editingCategory] = [];
      }
      subcategoriesMap[editingCategory].push(subcat);
    }
    
    subcategoriesMap = { ...subcategoriesMap };
    
    try {
      const docRef = doc(db, "settings", "subcategories");
      await setDoc(docRef, subcategoriesMap, { merge: true });
      successMsg = "Updated subcategory.";
      editingIndex = -1;
      if (editingCategory !== selectedCategory) {
         selectedCategory = editingCategory;
      }
    } catch (e: any) {
      errorMsg = "Failed to update: " + e.message;
    }
  }

  async function handleUpdateImage(event: Event, index: number) {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    
    const file = target.files[0];
    const subName = subcategoriesMap[selectedCategory][index].name;
    updatingImage = true;
    errorMsg = "";
    successMsg = "Uploading new image...";

    try {
      const downloadUrl = await uploadSubcategoryImage(file, selectedCategory, subName);

      subcategoriesMap[selectedCategory][index].imageUrl = downloadUrl;
      subcategoriesMap = { ...subcategoriesMap };

      const docRef = doc(db, "settings", "subcategories");
      await setDoc(docRef, subcategoriesMap, { merge: true });

      successMsg = `Updated image for ${subName}!`;
    } catch (e: any) {
      errorMsg = "Failed to update image: " + e.message;
    } finally {
      updatingImage = false;
      target.value = "";
    }
  }
</script>

<div class="header">
  <h1>Manage Subcategories</h1>
  <a href="/" class="back-link"><i class="fa fa-arrow-left" aria-hidden="true"></i> Back to Dashboard</a>
</div>

<p>Update the circular images that appear inside the Category Search tab.</p>

{#if loading}
  <p>Loading...</p>
{:else}
  <div class="card" style="margin-bottom: 20px;">
    <h3>Select Category</h3>
    <select bind:value={selectedCategory}>
      {#each mainCategories as cat}
        <option value={cat}>{cat}</option>
      {/each}
    </select>
  </div>

  <div class="card add-section">
    <h3>Upload New Subcategory Image</h3>
    <p style="font-size: 14px; color: #666; margin-bottom: 10px;">Select an image. Our AI will try to identify the item type and assign it to the correct Main Category; if it can't, you'll be asked for the name and it goes into the category selected above.</p>
    <div class="form-row">
      <label class="btn btn-primary" style="margin:0; width: 100%; text-align: center;">
        {adding ? 'Uploading & Analyzing...' : 'Upload Image'}
        <input type="file" accept="image/*" on:change={handleAutoUpload} disabled={adding} style="display:none;" />
      </label>
    </div>
    {#if successMsg}<p style="color: #28a745; font-weight: bold; margin-top: 10px;">{successMsg}</p>{/if}
    {#if errorMsg}<p style="color: #dc3545; font-weight: bold; margin-top: 10px;">{errorMsg}</p>{/if}
  </div>

  <div class="grid">
    {#each subcategoriesMap[selectedCategory] || [] as subcat, i}
      <div class="subcat-item">
        <img src={subcat.imageUrl} alt={subcat.name} />
        
        {#if editingIndex === i}
          <input type="text" bind:value={editingName} style="width: 90%; margin-bottom: 5px; padding: 5px; text-align: center;"/>
          <select bind:value={editingCategory} style="width: 90%; margin-bottom: 5px; padding: 5px;">
            {#each mainCategories as cat}
              <option value={cat}>{cat}</option>
            {/each}
          </select>
          <div style="display: flex; gap: 5px; justify-content: center;">
            <button class="btn btn-primary" style="padding: 5px; font-size: 12px;" on:click={saveEdit}>Save</button>
            <button class="btn" style="padding: 5px; font-size: 12px; background: #6c757d;" on:click={() => editingIndex = -1}>Cancel</button>
          </div>
        {:else}
          <p>{subcat.name}</p>
          <div style="display: flex; flex-direction: column; gap: 5px; margin-top: 10px;">
            <label class="btn" style="padding: 5px; font-size: 12px; margin: 0; cursor: pointer; background: #28a745;">
              {updatingImage ? 'Wait...' : 'Change Image'}
              <input type="file" accept="image/*" on:change={(e) => handleUpdateImage(e, i)} disabled={updatingImage} style="display:none;" />
            </label>
            <div style="display: flex; gap: 5px; justify-content: center;">
              <button class="btn btn-primary" style="padding: 5px; font-size: 12px; flex: 1;" on:click={() => startEdit(i)}>Rename</button>
              <button class="btn btn-danger" style="padding: 5px; font-size: 12px; margin: 0; flex: 1;" on:click={() => deleteSubcategory(i)}>Delete</button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
    {#if !subcategoriesMap[selectedCategory] || subcategoriesMap[selectedCategory].length === 0}
      <p>No subcategories found for {selectedCategory}. It will use the app's default hardcoded list until you add one.</p>
    {/if}
  </div>
{/if}

<style>
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; margin-bottom: 20px; padding-bottom: 10px; }
  .card { background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #ddd; }
  .form-row { display: flex; gap: 10px; margin-top: 10px; }
  .form-row input[type="text"] { flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; }
  .btn { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; color: white; }
  .btn-primary { background: #1673c4; }
  .btn-danger { background: #dc3545; padding: 5px 10px; margin-top: 5px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 20px; margin-top: 20px; }
  .subcat-item { text-align: center; background: white; padding: 10px; border-radius: 8px; border: 1px solid #eee; }
  .subcat-item img { width: 100px; height: 100px; object-fit: cover; border-radius: 50%; border: 2px solid #ddd; margin-bottom: 10px; }
  .subcat-item p { margin: 0; font-weight: bold; }
</style>
