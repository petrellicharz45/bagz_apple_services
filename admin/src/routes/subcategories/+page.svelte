<script lang="ts">
  import { to } from "$lib/paths";
  import { onMount } from "svelte";
  import { doc, getDoc, setDoc } from "firebase/firestore";
  import { getFunctions, httpsCallable } from "firebase/functions";
  import { db, app } from "$lib/firebase";
  import { uploadProductImage } from "$lib/images/cloudinaryUpload";
  import { resizeToJpeg } from "$lib/images/productImage";
  import { loadCategoryOrder, sortByOrder } from "$lib/data/categoryOrder";

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
  /** Shop search words for this tile ("galaxy s -tab", "case|cover"); empty = taken from the name. */
  let editingQuery = "";
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
         // Real shop categories first (in the admin order), then the virtual feeds.
         const staticCats = ["Just for You", "New In", "Sale"];
         const dynamicCats = sortByOrder(keys.filter(k => !staticCats.includes(k)), await loadCategoryOrder(db!));
         mainCategories = [...dynamicCats, ...staticCats];
      } else {
         mainCategories = ["iPhones", "Samsung", "Google Pixel", "MacBooks", "iPads", "Apple Watch", "AirPods & Audio", "Accessories", "Just for You", "New In", "Sale"];
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

  async function saveMap(message: string) {
    subcategoriesMap = { ...subcategoriesMap };
    const docRef = doc(db, "settings", "subcategories");
    await setDoc(docRef, subcategoriesMap, { merge: true });
    successMsg = message;
  }

  /** Add a subcategory by name only — the photo can be added later with "Add photo". */
  async function addByName() {
    const name = newSubName.trim();
    errorMsg = "";
    successMsg = "";
    if (!name || !selectedCategory) return;
    const list = subcategoriesMap[selectedCategory] || [];
    if (list.some((x) => String(x.name).toLowerCase() === name.toLowerCase())) {
      errorMsg = `"${name}" already exists in ${selectedCategory}.`;
      return;
    }
    adding = true;
    try {
      subcategoriesMap[selectedCategory] = [...list, { name, imageUrl: "" }];
      await saveMap(`Added ${name} to ${selectedCategory}. Add its photo any time.`);
      newSubName = "";
    } catch (e: any) {
      errorMsg = "Failed to add: " + e.message;
    } finally {
      adding = false;
    }
  }

  async function moveSub(index: number, delta: number) {
    const list = [...(subcategoriesMap[selectedCategory] || [])];
    const j = index + delta;
    if (j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    subcategoriesMap[selectedCategory] = list;
    try {
      await saveMap("Order saved.");
    } catch (e: any) {
      errorMsg = "Failed to reorder: " + e.message;
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
    editingQuery = subcategoriesMap[selectedCategory][index].query || "";
  }

  async function saveEdit() {
    if (!editingName.trim()) return;
    
    const subcat = subcategoriesMap[selectedCategory][editingIndex];
    subcat.name = editingName.trim();
    const q = editingQuery.trim().replace(/\s+/g, " ");
    if (q) subcat.query = q;
    else delete subcat.query;
    
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
  <a href={to("/")} class="back-link"><i class="fa fa-arrow-left" aria-hidden="true"></i> Back to Dashboard</a>
</div>

<p>Subcategories appear as round tiles inside each category on the shop. Add them by name now and upload their photos later.</p>

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

  <div class="card add-section" style="margin-bottom: 20px;">
    <h3>Add subcategory to {selectedCategory}</h3>
    <form class="form-row" on:submit|preventDefault={addByName}>
      <input type="text" bind:value={newSubName} placeholder="e.g. iPhone 16 Series" disabled={adding} />
      <button type="submit" class="btn btn-primary" disabled={adding || !newSubName.trim()}>
        <i class="fa fa-plus" aria-hidden="true"></i> {adding ? "Adding…" : "Add"}
      </button>
    </form>
  </div>

  <div class="card add-section">
    <h3>Or upload a photo to create one</h3>
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
        <div class="order-row">
          <button type="button" class="order-btn" title="Move earlier" aria-label="Move earlier" disabled={i === 0} on:click={() => moveSub(i, -1)}><i class="fa fa-arrow-left" aria-hidden="true"></i></button>
          <span class="order-num">{i + 1}</span>
          <button type="button" class="order-btn" title="Move later" aria-label="Move later" disabled={i === (subcategoriesMap[selectedCategory] || []).length - 1} on:click={() => moveSub(i, 1)}><i class="fa fa-arrow-right" aria-hidden="true"></i></button>
        </div>
        {#if subcat.imageUrl}
          <img src={subcat.imageUrl} alt={subcat.name} />
        {:else}
          <div class="no-photo"><i class="fa fa-picture-o" aria-hidden="true"></i><span>No photo yet</span></div>
        {/if}
        
        {#if editingIndex === i}
          <input type="text" bind:value={editingName} style="width: 90%; margin-bottom: 5px; padding: 5px; text-align: center;"/>
          <select bind:value={editingCategory} style="width: 90%; margin-bottom: 5px; padding: 5px;">
            {#each mainCategories as cat}
              <option value={cat}>{cat}</option>
            {/each}
          </select>
          <label class="query-field">
            Search words <span>(optional)</span>
            <input type="text" bind:value={editingQuery} placeholder="e.g. galaxy s -tab" />
            <small>Products whose name has these words. Use | for “or” (case|cover) and - to leave out (-tab). Empty = use the name.</small>
          </label>
          <div style="display: flex; gap: 5px; justify-content: center;">
            <button class="btn btn-primary" style="padding: 5px; font-size: 12px;" on:click={saveEdit}>Save</button>
            <button class="btn" style="padding: 5px; font-size: 12px; background: #6c757d;" on:click={() => editingIndex = -1}>Cancel</button>
          </div>
        {:else}
          <p>{subcat.name}</p>
          {#if subcat.query}
            <small class="query-note" title="Shop shows products whose name has these words">Shows: {subcat.query}</small>
          {/if}
          <div style="display: flex; flex-direction: column; gap: 5px; margin-top: 10px;">
            <label class="btn" style="padding: 5px; font-size: 12px; margin: 0; cursor: pointer; background: #28a745;">
              {updatingImage ? 'Wait...' : subcat.imageUrl ? 'Change Image' : 'Add photo'}
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
      <p>No subcategories in {selectedCategory} yet. The shop shows a single "Shop {selectedCategory}" tile until you add some.</p>
    {/if}
  </div>
{/if}

<style>
  .query-field { display: grid; gap: 3px; width: 90%; margin: 0 auto 6px; font-size: 12px; font-weight: 600; text-align: left; }
  .query-field span { font-weight: 400; color: #6b7280; }
  .query-field input { padding: 5px; }
  .query-field small { font-weight: 400; color: #6b7280; line-height: 1.3; }
  .query-note { display: block; margin-top: -4px; font-size: 11px; color: #6b7280; overflow-wrap: anywhere; }
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
  .no-photo { width: 100px; height: 100px; margin: 0 auto 10px; border-radius: 50%; border: 2px dashed #cbd5e1; background: #f8fafc; color: #94a3b8; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 11px; }
  .no-photo .fa { font-size: 22px; }
  .order-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .order-num { font-weight: 800; color: #94a3b8; font-size: 12px; }
  .order-btn { width: 26px; height: 26px; border-radius: 6px; border: 1px solid #d1d5db; background: #fff; color: #13344f; cursor: pointer; }
  .order-btn:disabled { opacity: 0.35; cursor: default; }
</style>
