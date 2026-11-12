import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "$lib/firebase";

export interface AppUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  imagePath: string;
  isAdmin: boolean;
  walletBalance: number;
  adminRole?: string;
  adminModules?: string[];
}

export const fetchAllUsersAndAdmins = async (): Promise<AppUser[]> => {
  // 1. Fetch all users
  const usersQuery = query(collection(db, "user"), orderBy("firstName"));
  const usersSnapshot = await getDocs(usersQuery);
  
  // 2. Fetch all admins (to cross-reference who has admin privileges)
  const adminsQuery = collection(db, "admin");
  const adminsSnapshot = await getDocs(adminsQuery);
  
  // Create a set of admin UIDs for fast lookup
  const adminMeta = new Map(
    adminsSnapshot.docs.map((doc) => [doc.id, doc.data() as { role?: string; modules?: string[] }])
  );

  const users: AppUser[] = usersSnapshot.docs.map((doc) => {
    const data = doc.data();
    const meta = adminMeta.get(doc.id);
    return {
      id: doc.id,
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      email: data.email || "",
      imagePath: data.imagePath || "",
      isAdmin: adminMeta.has(doc.id),
      walletBalance: typeof data.walletBalance === "number" ? data.walletBalance : 0,
      adminRole: meta?.role,
      adminModules: meta?.modules
    };
  });

  return users;
};
