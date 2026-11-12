import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "$lib/firebase";

/** Shop merchandising groups (product checkboxes + shop filters). Admin-managed in settings/groups. */
export const DEFAULT_GROUPS = ["Brand New", "Certified Pre-owned", "Deals", "Recommended"];

/** "Recommended" is a group now, not a category — keep it out of the Category dropdown. */
export const NOT_A_CATEGORY = "Recommended";

const groupsRef = () => doc(db!, "settings", "groups");

export async function loadGroups(): Promise<string[]> {
  try {
    const snap = await getDoc(groupsRef());
    const list = snap.exists() ? snap.data().list : null;
    if (Array.isArray(list)) return list.filter((g) => typeof g === "string" && g.trim());
  } catch (e) {
    console.error("Failed to load groups:", e);
  }
  return [...DEFAULT_GROUPS];
}

export async function saveGroups(list: string[]): Promise<void> {
  await setDoc(groupsRef(), { list });
}

/** Category dropdown options; an existing product's old "Recommended" category is kept so it isn't silently changed. */
export function categoryOptions(keys: string[], current = ""): string[] {
  return keys.filter((k) => k !== NOT_A_CATEGORY || k === current);
}
