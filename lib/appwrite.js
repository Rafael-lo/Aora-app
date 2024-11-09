import {
    Account,
    Avatars,
    Client,
    Databases,
    ID,
    Query,
    Storage,
  } from "react-native-appwrite";
  
  export const appwriteConfig = {
    endpoint: "https://cloud.appwrite.io/v1",
    platform: "com.jsm.aora",
    projectId: "672ea0b10009e86a071e",
    storageId: "672ea70d0020b7fec7c7",
    databaseId: "672ea2bc00127d41f8e3",
    userCollectionId: "672ea2e7000616cf38af",
    videoCollectionId: "672ea373000fd9eec9fd",
  };
  
  const client = new Client();
  
  client
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId)
    .setPlatform(appwriteConfig.platform);
  
  const account = new Account(client);
  const storage = new Storage(client);
  const avatars = new Avatars(client);
  const databases = new Databases(client);
  
// Register user
export async function createUser(email, password, username) {
    try {
      // Step 1: Create the user using the Users service (not Account)
      const newAccount = await account.create(ID.unique(), email, password, username);
    
      if (!newAccount) throw new Error('Failed to create user');
    
      // Step 2: Generate avatar URL based on username (e.g., initials)
      const avatarUrl = avatars.getInitials(username);
    
      // Step 3: Sign the user in by creating a session
      await signIn(email, password);  // This will create the session for the user
    
      // Step 4: Store additional user information in your Appwrite database
      // Generate a valid custom userId for document creation (use ID.unique() for a valid ID)
      const customUserId = ID.unique();  // This will generate a valid UUID v4 ID
      
      console.log('Generated customUserId:', customUserId); // Log for debugging
  
      // Step 5: Store user data in the database
      const newUser = await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.userCollectionId,
        customUserId,  // Use the valid userId for document
        {
          accountId: newAccount.$id,  // The actual account ID from Appwrite
          email: email,
          username: username,
          avatar: avatarUrl,
        }
      );
    
      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error(error);
    }
  }
  
  // Sign In
  export async function signIn(email, password) {
    try {
      // Step 1: Create a session for the user with their email and password
      const session = await account.createEmailPasswordSession(email, password);  // Using createSession for login
    
      return session;
    } catch (error) {
      console.error('Error during sign-in:', error);
      throw new Error(error);
    }
  }
  
  // Get Account
  export async function getAccount() {
    try {
      const currentAccount = await account.get();
  
      return currentAccount;
    } catch (error) {
      throw new Error(error);
    }
  }
  
// Get current user
export async function getCurrentUser() {
    try {
      // Step 1: Get the current authenticated account
      const currentAccount = await account.get();
      if (!currentAccount || !currentAccount.$id) {
        console.error('No authenticated account found');
        return null;
      }
  
      // Step 2: Query the database for the user document
      const currentUser = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.userCollectionId,
        [Query.equal("accountId", currentAccount.$id)]
      );
      
      // Step 3: Check if the user was found in the database
      if (!currentUser.documents || currentUser.documents.length === 0) {
        console.error('No user document found for the current account');
        return null;
      }
      
      // Return the first user document found
      return currentUser.documents[0];
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }
  
// Sign Out
export async function signOut() {
    try {
      // Step 1: Check if the user has an active session
      const session = await account.getSession('current');
      
      if (session) {
        // Step 2: Delete the current session
        const deletedSession = await account.deleteSession("current");
        console.log('Session deleted:', deletedSession);
        return deletedSession;
      } else {
        console.log('No active session found.');
      }
    } catch (error) {
      console.error('Error during sign-out:', error);
      throw new Error(error);
    }
  }
  
  // Upload File
  export async function uploadFile(file, type) {
    if (!file) return;
  
    const { mimeType, ...rest } = file;
    const asset = { type: mimeType, ...rest };
  
    try {
      const uploadedFile = await storage.createFile(
        appwriteConfig.storageId,
        ID.unique(),
        asset
      );
  
      const fileUrl = await getFilePreview(uploadedFile.$id, type);
      return fileUrl;
    } catch (error) {
      throw new Error(error);
    }
  }
  
  // Get File Preview
  export async function getFilePreview(fileId, type) {
    let fileUrl;
  
    try {
      if (type === "video") {
        fileUrl = storage.getFileView(appwriteConfig.storageId, fileId);
      } else if (type === "image") {
        fileUrl = storage.getFilePreview(
          appwriteConfig.storageId,
          fileId,
          2000,
          2000,
          "top",
          100
        );
      } else {
        throw new Error("Invalid file type");
      }
  
      if (!fileUrl) throw Error;
  
      return fileUrl;
    } catch (error) {
      throw new Error(error);
    }
  }
  
  // Create Video Post
  export async function createVideoPost(form) {
    try {
      const [thumbnailUrl, videoUrl] = await Promise.all([
        uploadFile(form.thumbnail, "image"),
        uploadFile(form.video, "video"),
      ]);
  
      const newPost = await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.videoCollectionId,
        ID.unique(),
        {
          title: form.title,
          thumbnail: thumbnailUrl,
          video: videoUrl,
          prompt: form.prompt,
          creator: form.userId,
        }
      );
  
      return newPost;
    } catch (error) {
      throw new Error(error);
    }
  }
  
  // Get all video Posts
  export async function getAllPosts() {
    try {
      const posts = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.videoCollectionId
      );
  
      return posts.documents;
    } catch (error) {
      throw new Error(error);
    }
  }
  
  // Get video posts created by user
  export async function getUserPosts(userId) {
    try {
      const posts = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.videoCollectionId,
        [Query.equal("creator", userId)]
      );
  
      return posts.documents;
    } catch (error) {
      throw new Error(error);
    }
  }
  
  // Get video posts that matches search query
  export async function searchPosts(query) {
    try {
      const posts = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.videoCollectionId,
        [Query.search("title", query)]
      );
  
      if (!posts) throw new Error("Something went wrong");
  
      return posts.documents;
    } catch (error) {
      throw new Error(error);
    }
  }
  
  // Get latest created video posts
  export async function getLatestPosts() {
    try {
      const posts = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.videoCollectionId,
        [Query.orderDesc("$createdAt"), Query.limit(7)]
      );
  
      return posts.documents;
    } catch (error) {
      throw new Error(error);
    }
  }