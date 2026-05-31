// Addis Closet Swap - Application Engine
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  query, where, runTransaction 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// --- 1. CONFIGURATION & STATE SYSTEM ---
const isFirebaseConfigured = window.firebaseConfig && 
  window.firebaseConfig.apiKey && 
  window.firebaseConfig.apiKey !== "YOUR_API_KEY_HERE" &&
  window.firebaseConfig.projectId !== "YOUR_PROJECT_ID_HERE";

// Telegram posting configuration
// Telegram posting configuration
// IMPORTANT SECURITY NOTE: Do NOT ship your bot token in client-side code for production.
// Host a Cloud Function or secure server endpoint that holds the bot token and performs
// Telegram Bot API calls. This client-side app should only call that secure endpoint.

// HOW TO GET THESE VALUES:
// 1) Create a bot with BotFather in Telegram. BotFather will return a Bot Token (format: 123456:ABC-DEF...).
//    Keep that token secret and store it on your server/Cloud Function environment variables.
// 2) To get your channel ID for a channel you manage, add your bot as an admin to the channel,
//    then use @userinfobot or inspect the channel via Telegram Web to obtain the channel's ID.
//    Public channels use @channelusername; private channels show IDs like -1001234567890.

const TELEGRAM_BOT_TOKEN = ""; // (optional here) BotFather token — DO NOT expose publicly
const TELEGRAM_CHANNEL_ID = "-100xxxxxxxxxx"; // e.g. -1001234567890
// Secure endpoint that performs the actual Bot API requests using the secret bot token.
// Deploy a Cloud Function at this URL that accepts a POST with item data and posts to Telegram.
const TELEGRAM_POST_ENDPOINT = "https://us-central1-YOUR_PROJECT.cloudfunctions.net/postTelegramItem"; // Replace with your secure endpoint

let firebaseApp = null;
let firestoreDb = null;
let firebaseStorage = null;

// Global application state
const AppState = {
  currentUser: null,       // Current user details (Telegram info)
  currentSeller: null,     // Current seller profile (if applied/approved)
  items: [],               // Feed items (only approved/active for users, all for admin)
  activeScreen: 'screen-browse',
  historyStack: ['screen-browse'],
  selectedItem: null,      // Currently viewed item details
  isAdminMode: false,      // Controls visibility of admin panel
  currentAdminTab: 'pending-items',
  filters: {
    search: '',
    category: '',
    size: '',
    location: '',
    conditions: [],
    priceMax: 10000
    ,dateRange: 'recent'
  },
  photosToUpload: [] // Temporary storage for photos to be uploaded
};

// Seed Items
const SEED_ITEMS = [
  {
    itemId: "CS-1001",
    name: "Zara Wrap Dress",
    primaryCategory: "Women",
    subcategory: "Dresses",
    brand: "Zara",
    size: "M",
    condition: "Like New",
    price: 1500,
    location: "Bole",
    description: "Elegant green wrap dress, worn once for a wedding. Material is lightweight and very comfortable.",
    flaws: "None",
    reasonForSelling: "No longer fits",
    photos: ["https://picsum.photos/seed/zara/600/600"],
    sellerId: "seller_sara",
    sellerName: "Sara M.",
    sellerUsername: "saram_ethio",
    sellerStatus: "Verified Seller",
    sellerExchanges: 4,
    status: "Active",
    listedDate: Date.now() - 3 * 24 * 60 * 60 * 1000,
    soldDate: null
  },
  {
    itemId: "CS-1002",
    name: "H&M Blazer",
    primaryCategory: "Women",
    subcategory: "Outerwear",
    brand: "H&M",
    size: "L",
    condition: "Good",
    price: 1800,
    location: "CMC",
    description: "Classic black oversized blazer. Great structure, fully lined inside. Perfect for professional or casual outfits.",
    flaws: "Missing one sleeve button",
    reasonForSelling: "Upgraded to a different style",
    photos: ["https://picsum.photos/seed/blazer/600/600"],
    sellerId: "seller_marta",
    sellerName: "Marta K.",
    sellerUsername: "martak_closet",
    sellerStatus: "Active Seller",
    sellerExchanges: 1,
    status: "Active",
    listedDate: Date.now() - 5 * 24 * 60 * 60 * 1000,
    soldDate: null
  },
  {
    itemId: "CS-1003",
    name: "Nike Sneakers",
    primaryCategory: "Shoes",
    subcategory: "Sneakers",
    brand: "Nike",
    size: "43",
    condition: "Like New",
    price: 2200,
    location: "Bole",
    description: "Nike Air Force 1. Clean silhouette, only worn twice. Kept in original box.",
    flaws: "None",
    reasonForSelling: "Slightly too tight",
    photos: ["https://picsum.photos/seed/nike/600/600"],
    sellerId: "seller_david",
    sellerName: "David T.",
    sellerUsername: "davidt_swaps",
    sellerStatus: "Top Contributor",
    sellerExchanges: 12,
    status: "Active",
    listedDate: Date.now() - 1 * 24 * 60 * 60 * 1000,
    soldDate: null
  },
  {
    itemId: "CS-1004",
    name: "Michael Kors Bag",
    primaryCategory: "Bags",
    subcategory: "Handbags",
    brand: "Michael Kors",
    size: "Medium",
    condition: "Good",
    price: 3500,
    location: "Piassa",
    description: "Saffiano leather handbag in beige. Gold hardware. Highly durable, spacious structure.",
    flaws: "Minor scratches on metal clasps",
    reasonForSelling: "Got a new purse for graduation",
    photos: ["https://picsum.photos/seed/mkbag/600/600"],
    sellerId: "seller_helen",
    sellerName: "Helen A.",
    sellerUsername: "helena_luxury",
    sellerStatus: "Verified Seller",
    sellerExchanges: 7,
    status: "Active",
    listedDate: Date.now() - 10 * 24 * 60 * 60 * 1000,
    soldDate: null
  },
  {
    itemId: "CS-1005",
    name: "Crux Denim Trousers",
    primaryCategory: "Men",
    subcategory: "Pants",
    brand: "Crux",
    size: "34",
    condition: "New",
    price: 1500,
    location: "Bole",
    description: "Brand new with tags still attached. Straight-leg fit denim, medium wash.",
    flaws: "None",
    reasonForSelling: "Bought online, wrong waist size",
    photos: ["https://picsum.photos/seed/denim/600/600"],
    sellerId: "seller_yonas",
    sellerName: "Yonas B.",
    sellerUsername: "yonasb_streetwear",
    sellerStatus: "New Seller",
    sellerExchanges: 0,
    status: "Active",
    listedDate: Date.now() - 12 * 24 * 60 * 60 * 1000,
    soldDate: null
  }
];

const SEED_SELLERS = [
  { telegramId: "seller_sara", telegramUsername: "saram_ethio", fullName: "Sara M.", phone: "+251911000001", location: "Bole", status: "Verified", exchangesCount: 4, rating: 4.8, joinedDate: Date.now() - 30 * 24 * 60 * 60 * 1000, itemsListed: 4 },
  { telegramId: "seller_marta", telegramUsername: "martak_closet", fullName: "Marta K.", phone: "+251911000002", location: "CMC", status: "Active", exchangesCount: 1, rating: 4.5, joinedDate: Date.now() - 20 * 24 * 60 * 60 * 1000, itemsListed: 2 },
  { telegramId: "seller_david", telegramUsername: "davidt_swaps", fullName: "David T.", phone: "+251911000003", location: "Bole", status: "Top Contributor", exchangesCount: 12, rating: 4.9, joinedDate: Date.now() - 90 * 24 * 60 * 60 * 1000, itemsListed: 15 },
  { telegramId: "seller_helen", telegramUsername: "helena_luxury", fullName: "Helen A.", phone: "+251911000004", location: "Piassa", status: "Verified", exchangesCount: 7, rating: 4.7, joinedDate: Date.now() - 40 * 24 * 60 * 60 * 1000, itemsListed: 9 },
  { telegramId: "seller_yonas", telegramUsername: "yonasb_streetwear", fullName: "Yonas B.", phone: "+251911000005", location: "Bole", status: "Active", exchangesCount: 0, rating: 4.0, joinedDate: Date.now() - 15 * 24 * 60 * 60 * 1000, itemsListed: 1 }
];

// --- 2. UNIFIED DATABASE LAYER (ADAPTER) ---
const DB = {
  async getItems() {
    if (isFirebaseConfigured) {
      const q = collection(firestoreDb, "items");
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(d => list.push(d.data()));
      return list;
    } else {
      let items = localStorage.getItem('addis_items');
      if (!items) {
        items = JSON.stringify(SEED_ITEMS);
        localStorage.setItem('addis_items', items);
      }
      return JSON.parse(items);
    }
  },

  async saveItem(item) {
    if (isFirebaseConfigured) {
      await setDoc(doc(firestoreDb, "items", item.itemId), item);
    } else {
      const items = await this.getItems();
      const idx = items.findIndex(i => i.itemId === item.itemId);
      if (idx > -1) {
        items[idx] = item;
      } else {
        items.push(item);
      }
      localStorage.setItem('addis_items', JSON.stringify(items));
    }
  },

  async getSellerById(telegramId) {
    if (isFirebaseConfigured) {
      const docRef = doc(firestoreDb, "sellers", telegramId);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() : null;
    } else {
      const sellers = await this.getAllSellers();
      return sellers.find(s => s.telegramId === telegramId) || null;
    }
  },

  async saveSeller(seller) {
    if (isFirebaseConfigured) {
      await setDoc(doc(firestoreDb, "sellers", seller.telegramId), seller);
    } else {
      const sellers = await this.getAllSellers();
      const idx = sellers.findIndex(s => s.telegramId === seller.telegramId);
      if (idx > -1) {
        sellers[idx] = seller;
      } else {
        sellers.push(seller);
      }
      localStorage.setItem('addis_sellers', JSON.stringify(sellers));
    }
  },

  async getAllSellers() {
    if (isFirebaseConfigured) {
      const q = collection(firestoreDb, "sellers");
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(d => list.push(d.data()));
      return list;
    } else {
      let sellers = localStorage.getItem('addis_sellers');
      if (!sellers) {
        sellers = JSON.stringify(SEED_SELLERS);
        localStorage.setItem('addis_sellers', sellers);
      }
      return JSON.parse(sellers);
    }
  },

  async getNextItemId() {
    if (isFirebaseConfigured) {
      const counterRef = doc(firestoreDb, "metadata", "counters");
      try {
        const nextId = await runTransaction(firestoreDb, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          if (!counterDoc.exists()) {
            transaction.set(counterRef, { lastItemId: 1005 });
            return 1006;
          }
          const newId = (counterDoc.data().lastItemId || 1005) + 1;
          transaction.update(counterRef, { lastItemId: newId });
          return newId;
        });
        return `CS-${nextId}`;
      } catch (e) {
        console.warn("Firestore Counter Transaction failed, falling back to query max ID", e);
        const items = await this.getItems();
        let max = 1005;
        items.forEach(i => {
          const num = parseInt(i.itemId?.replace("CS-", "") || "0");
          if (num > max) max = num;
        });
        const nextNum = max + 1;
        try {
          await setDoc(counterRef, { lastItemId: nextNum });
        } catch(err){}
        return `CS-${nextNum}`;
      }
    } else {
      const items = await this.getItems();
      let max = 1005;
      items.forEach(i => {
        const num = parseInt(i.itemId?.replace("CS-", "") || "0");
        if (num > max) max = num;
      });
      return `CS-${max + 1}`;
    }
  },

  async uploadPhoto(file) {
    if (isFirebaseConfigured) {
      // client side compression
      const compressedBlob = await compressImageFile(file, 800, 0.8);
      const filename = `listings/${AppState.currentUser.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`;
      const storageRef = ref(firebaseStorage, filename);
      await uploadBytes(storageRef, compressedBlob);
      return await getDownloadURL(storageRef);
    } else {
      // Compress highly for LocalStorage (to fit in quota)
      const base64Data = await compressImageToDataUrl(file, 360, 0.7);
      return base64Data;
    }
  }
};

// --- Telegram posting utility -------------------------------------------------
// IMPORTANT: Do NOT expose `TELEGRAM_BOT_TOKEN` in client-side code for production.
// Implement a secure Cloud Function or server endpoint that performs the Bot API calls.
// This client helper forwards a request to that secure endpoint which performs the
// actual Telegram API interaction using the bot token kept on the server.
async function postItemToTelegramChannel(item) {
  if (!TELEGRAM_POST_ENDPOINT) {
    throw new Error('TELEGRAM_POST_ENDPOINT is not configured.');
  }

  const body = {
    chatId: TELEGRAM_CHANNEL_ID,
    item: {
      itemId: item.itemId,
      name: item.name,
      primaryCategory: item.primaryCategory,
      subcategory: item.subcategory,
      brand: item.brand,
      size: item.size,
      condition: item.condition,
      location: item.location,
      price: item.price,
      description: item.description,
      flaws: item.flaws,
      sellerName: item.sellerName,
      sellerStatus: item.sellerStatus,
      sellerUsername: item.sellerUsername,
      listedDate: item.listedDate,
      photos: item.photos || []
    },
    appLink: window.location.href
  };

  const resp = await fetch(TELEGRAM_POST_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(txt || 'Telegram post failed');
  }
  return resp.json();
}

// --- 3. HELPER UTILITIES ---
// Compression utilities
function compressImageFile(file, maxWidth, quality) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function compressImageToDataUrl(file, maxWidth, quality) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Global functions for inline Event Handlers
window.navigateTo = navigateTo;
window.handleFileSelect = handleFileSelect;
window.deletePhotoInput = deletePhotoInput;
window.switchAdminTab = switchAdminTab;
window.approveItemAdmin = approveItemAdmin;
window.rejectItemAdmin = rejectItemAdmin;
window.approveSellerAdmin = approveSellerAdmin;
window.rejectSellerAdmin = rejectSellerAdmin;
window.toggleItemStatusAdmin = toggleItemStatusAdmin;
window.toggleSellerStatusAdmin = toggleSellerStatusAdmin;

// Show temporary messages
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// Convert timestamp to human readable date
function formatDate(timestamp) {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- 4. ROUTING SYSTEM & NAVIGATION ---
function navigateTo(screenId, direction = 'forward') {
  const prevScreen = AppState.activeScreen;
  
  // Hide current active screen
  const currentElem = document.getElementById(prevScreen);
  if (currentElem) currentElem.classList.remove('active');

  // Show new active screen
  const targetElem = document.getElementById(screenId);
  if (targetElem) {
    targetElem.classList.add('active');
    AppState.activeScreen = screenId;
  }

  // Update BackButton
  if (screenId === 'screen-browse') {
    Telegram.WebApp.BackButton.hide();
    AppState.historyStack = ['screen-browse'];
  } else {
    Telegram.WebApp.BackButton.show();
    if (direction === 'forward') {
      AppState.historyStack.push(screenId);
    }
  }

  // Handle Tab Activation Visuals
  document.querySelectorAll('#bottom-nav .nav-tab').forEach(tab => tab.classList.remove('active'));
  if (screenId === 'screen-browse') {
    document.querySelector('[onclick="navigateTo(\'screen-browse\')"]').classList.add('active');
  } else if (screenId === 'screen-seller-dashboard' || screenId === 'screen-add-listing' || screenId === 'screen-apply-seller') {
    document.querySelector('[onclick="navigateTo(\'screen-seller-dashboard\')"]').classList.add('active');
  } else if (screenId === 'screen-account' || screenId === 'screen-admin') {
    document.querySelector('[onclick="navigateTo(\'screen-account\')"]').classList.add('active');
  }

  // Setup specific screen details on load
  if (screenId === 'screen-browse') {
    renderBrowseFeed();
  } else if (screenId === 'screen-seller-dashboard') {
    checkSellerStatusAndLoadDashboard();
  } else if (screenId === 'screen-account') {
    renderAccountScreen();
  } else if (screenId === 'screen-admin') {
    renderAdminPanel();
  }

  // Manage Telegram SDK MainButton behavior dynamically
  handleMainButtonState(screenId);
}

// Hook Telegram SDK back button
Telegram.WebApp.BackButton.onClick(() => {
  if (AppState.historyStack.length > 1) {
    AppState.historyStack.pop(); // remove current screen
    const prevScreen = AppState.historyStack[AppState.historyStack.length - 1];
    navigateTo(prevScreen, 'backward');
  }
});

// Configure TG MainButton based on screens
function handleMainButtonState(screenId) {
  const mb = Telegram.WebApp.MainButton;
  
  if (screenId === 'screen-apply-seller') {
    mb.setText("SUBMIT APPLICATION");
    mb.show();
    mb.enable();
    mb.offClick(handleApplySubmitClick); // clear previous listeners
    mb.onClick(handleApplySubmitClick);
  } else if (screenId === 'screen-add-listing') {
    mb.setText("SUBMIT LISTING FOR REVIEW");
    mb.show();
    mb.enable();
    mb.offClick(handleAddListingClick);
    mb.onClick(handleAddListingClick);
  } else if (screenId === 'screen-detail' && AppState.selectedItem) {
    const item = AppState.selectedItem;
    if (item.status === 'Active') {
      mb.setText("CONTACT SELLER");
      mb.show();
      mb.enable();
      mb.offClick(handleContactSellerClick);
      mb.onClick(handleContactSellerClick);
    } else {
      mb.hide();
    }
  } else {
    mb.hide();
  }
}

// TG MainButton Click Listeners
function handleApplySubmitClick() {
  document.getElementById("submit-application-btn").click();
}

function handleAddListingClick() {
  document.getElementById("submit-listing-btn").click();
}

function handleContactSellerClick() {
  document.getElementById("contact-seller-btn").click();
}

// --- 5. DATA INJECTION & RENDERING ---

// Browse Feed Rendering
function renderBrowseFeed() {
  const container = document.getElementById("items-list");
  const emptyState = document.getElementById("browse-empty");
  container.innerHTML = "";
  
  // Show approved/active items for public feed. If simulated admin toggle is active, also show others maybe? 
  // Let's filter to only active items for regular browse
  let filtered = AppState.items.filter(item => item.status === 'Active');

  // Apply Search
  const searchVal = AppState.filters.search.toLowerCase().trim();
  if (searchVal) {
    filtered = filtered.filter(item => 
      item.name.toLowerCase().includes(searchVal) || 
      item.brand.toLowerCase().includes(searchVal) ||
      item.subcategory.toLowerCase().includes(searchVal) ||
      item.description.toLowerCase().includes(searchVal)
    );
  }

  // Apply Filters
  if (AppState.filters.category) {
    filtered = filtered.filter(item => item.primaryCategory === AppState.filters.category);
  }
  if (AppState.filters.size) {
    filtered = filtered.filter(item => item.size.toLowerCase().includes(AppState.filters.size.toLowerCase()));
  }
  if (AppState.filters.location) {
    filtered = filtered.filter(item => item.location === AppState.filters.location);
  }
  if (AppState.filters.conditions.length > 0) {
    filtered = filtered.filter(item => AppState.filters.conditions.includes(item.condition));
  }
  if (AppState.filters.priceMax) {
    filtered = filtered.filter(item => item.price <= AppState.filters.priceMax);
  }
  if (AppState.filters.dateRange && AppState.filters.dateRange !== 'all') {
    const now = Date.now();
    let start = now;
    if (AppState.filters.dateRange === 'recent') {
      start = now - 72 * 60 * 60 * 1000;
    } else if (AppState.filters.dateRange === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      start = today.getTime();
    } else if (AppState.filters.dateRange === 'week') {
      start = now - 7 * 24 * 60 * 60 * 1000;
    } else if (AppState.filters.dateRange === 'month') {
      start = now - 30 * 24 * 60 * 60 * 1000;
    }
    filtered = filtered.filter(item => item.listedDate >= start && item.listedDate <= now);
  }

  if (filtered.length === 0) {
    emptyState.style.display = "flex";
    return;
  }
  emptyState.style.display = "none";

  filtered.forEach(item => {
    const card = document.createElement("div");
    card.className = "item-card";
    
    // Condition Badge class mapping
    let condClass = "badge-good";
    if (item.condition === "New") condClass = "badge-new";
    else if (item.condition === "Like New") condClass = "badge-likenew";
    else if (item.condition === "Fair") condClass = "badge-fair";

    card.innerHTML = `
      <img src="${item.photos[0] || 'https://picsum.photos/seed/placeholder/300/300'}" class="item-card-image" alt="${item.name}" loading="lazy">
      <div class="item-card-details">
        <div class="item-card-header">
          <div class="item-card-name">${item.name}</div>
          <div class="item-card-price">${item.price} Birr</div>
        </div>
        <div class="item-card-meta">Size ${item.size} · ${item.location}</div>
        <div class="item-card-badges">
          <span class="badge ${condClass}">${item.condition}</span>
          <span class="badge badge-seller">${item.sellerStatus || 'Seller'}</span>
        </div>
      </div>
    `;

    card.addEventListener("click", () => {
      AppState.selectedItem = item;
      navigateTo('screen-detail');
      renderItemDetail(item);
    });

    container.appendChild(card);
  });
}

// Item Detail Screen Rendering
let carouselIndex = 0;
function renderItemDetail(item) {
  carouselIndex = 0;
  
  // Set detail fields
  document.getElementById("detail-item-id").textContent = `ITEM ID: ${item.itemId}`;
  document.getElementById("detail-name").textContent = item.name;
  document.getElementById("detail-price").textContent = `${item.price} Birr`;
  document.getElementById("detail-category").textContent = `${item.primaryCategory} > ${item.subcategory || ''}`;
  document.getElementById("detail-brand").textContent = item.brand;
  document.getElementById("detail-size").textContent = item.size;
  document.getElementById("detail-condition").textContent = item.condition;
  document.getElementById("detail-location").textContent = item.location;
  document.getElementById("detail-date").textContent = formatDate(item.listedDate);
  document.getElementById("detail-description").textContent = item.description;
  
  // Flaws
  const flawsAlert = document.getElementById("detail-flaws-alert");
  const flawsText = document.getElementById("detail-flaws");
  flawsText.textContent = item.flaws || "None";
  if (item.flaws && item.flaws.toLowerCase() !== "none") {
    flawsAlert.className = "flaws-alert has-flaws";
  } else {
    flawsAlert.className = "flaws-alert";
  }

  // Reason
  const reasonSec = document.getElementById("detail-reason-section");
  const reasonText = document.getElementById("detail-reason");
  if (item.reasonForSelling && item.reasonForSelling.trim() !== "") {
    reasonSec.style.display = "flex";
    reasonText.textContent = item.reasonForSelling;
  } else {
    reasonSec.style.display = "none";
  }

  // Seller Card
  document.getElementById("detail-seller-name").textContent = item.sellerName;
  document.getElementById("detail-seller-exchanges").textContent = item.sellerExchanges || 0;
  
  // Seller status badge class
  const sellerBadge = document.getElementById("detail-seller-status-badge");
  sellerBadge.textContent = item.sellerStatus || "New Seller";
  sellerBadge.className = "badge";
  if (item.sellerStatus === "Verified Seller") sellerBadge.classList.add("status-active");
  else if (item.sellerStatus === "Top Contributor") sellerBadge.classList.add("status-active");
  else sellerBadge.classList.add("badge-seller");

  // Contact button link setup
  const contactBtn = document.getElementById("contact-seller-btn");
  contactBtn.replaceWith(contactBtn.cloneNode(true)); // remove old listener
  const newContactBtn = document.getElementById("contact-seller-btn");
  
  newContactBtn.addEventListener("click", () => {
    if (item.sellerUsername) {
      window.open(`https://t.me/${item.sellerUsername}`, '_blank');
    } else {
      showToast("No username listed. Please contact Admin.");
    }
  });

  // Render Carousel
  const slides = document.getElementById("carousel-slides");
  const dots = document.getElementById("carousel-dots");
  slides.innerHTML = "";
  dots.innerHTML = "";
  
  const photos = item.photos && item.photos.length > 0 ? item.photos : ['https://picsum.photos/seed/placeholder/600/600'];
  
  photos.forEach((photo, idx) => {
    const slide = document.createElement("div");
    slide.className = "carousel-slide";
    slide.innerHTML = `<img src="${photo}" alt="Product Photo" loading="lazy">`;
    slides.appendChild(slide);

    const dot = document.createElement("span");
    dot.className = `carousel-dot ${idx === 0 ? 'active' : ''}`;
    dot.addEventListener("click", () => setCarouselSlide(idx));
    dots.appendChild(dot);
  });

  // Carousel Next/Prev listeners
  document.getElementById("carousel-prev").replaceWith(document.getElementById("carousel-prev").cloneNode(true));
  document.getElementById("carousel-next").replaceWith(document.getElementById("carousel-next").cloneNode(true));
  
  document.getElementById("carousel-prev").addEventListener("click", () => {
    setCarouselSlide(carouselIndex - 1);
  });
  document.getElementById("carousel-next").addEventListener("click", () => {
    setCarouselSlide(carouselIndex + 1);
  });

  // Similar items rendering
  renderSimilarItems(item);
}

function setCarouselSlide(index) {
  const slides = document.getElementById("carousel-slides");
  const dots = document.querySelectorAll(".carousel-dot");
  if (!slides || dots.length === 0) return;
  
  const maxIdx = dots.length - 1;
  if (index < 0) index = maxIdx;
  if (index > maxIdx) index = 0;
  
  carouselIndex = index;
  slides.style.transform = `translateX(-${index * 100}%)`;
  
  dots.forEach((dot, idx) => {
    if (idx === index) dot.classList.add("active");
    else dot.classList.remove("active");
  });
}

function renderSimilarItems(currentItem) {
  const container = document.getElementById("similar-items-grid");
  container.innerHTML = "";
  
  // same category, active, not current item, max 3 items
  const matches = AppState.items.filter(item => 
    item.status === 'Active' && 
    item.itemId !== currentItem.itemId && 
    item.primaryCategory === currentItem.primaryCategory
  ).slice(0, 3);

  if (matches.length === 0) {
    container.innerHTML = `<p style="grid-column: span 3; text-align: center; color: var(--text-secondary); font-size: 13px;">No similar items found.</p>`;
    return;
  }

  matches.forEach(item => {
    const card = document.createElement("div");
    card.className = "similar-card";
    card.innerHTML = `
      <img src="${item.photos[0] || 'https://picsum.photos/seed/placeholder/200/200'}" class="similar-image" alt="${item.name}">
      <div class="similar-name">${item.name}</div>
      <div class="similar-price">${item.price} Birr</div>
    `;
    card.addEventListener("click", () => {
      AppState.selectedItem = item;
      renderItemDetail(item);
    });
    container.appendChild(card);
  });
}

// Onboarding: Check status & render Dashboard/Application
async function checkSellerStatusAndLoadDashboard() {
  if (!AppState.currentUser) return;
  
  // Show Loading state
  const dashContainer = document.getElementById("screen-seller-dashboard");
  const applyContainer = document.getElementById("screen-apply-seller");
  
  const seller = await DB.getSellerById(AppState.currentUser.id);
  AppState.currentSeller = seller;

  if (!seller) {
    // Not applied, go to Apply Form
    navigateTo('screen-apply-seller');
    // Pre-populate name if possible from TG
    if (AppState.currentUser.first_name) {
      document.getElementById("apply-name").value = `${AppState.currentUser.first_name} ${AppState.currentUser.last_name || ''}`.trim();
    }
  } else if (seller.status === "Pending") {
    // Applied, show Pending Screen in Account tab
    showToast("Your application is currently pending admin approval.");
    navigateTo('screen-account');
  } else if (seller.status === "Banned") {
    showToast("This seller account has been banned.");
    navigateTo('screen-account');
  } else {
    // Approved! Render dashboard
    renderSellerDashboard(seller);
  }
}

function renderSellerDashboard(seller) {
  document.getElementById("dash-seller-name").textContent = seller.fullName;
  document.getElementById("dash-seller-status").textContent = `Status: ${seller.status} Seller`;
  
  // Set Dashboard Stats
  const sellerItems = AppState.items.filter(item => item.sellerId === seller.telegramId);
  const activeCount = sellerItems.filter(item => item.status === 'Active').length;
  const soldCount = sellerItems.filter(item => item.status === 'Sold').length;
  
  document.getElementById("stat-listed").textContent = sellerItems.length;
  document.getElementById("stat-sold").textContent = soldCount;
  document.getElementById("stat-exchanges").textContent = seller.exchangesCount || 0;
  document.getElementById("stat-rating").textContent = (seller.rating || 0).toFixed(1);

  // Render listing items
  const container = document.getElementById("seller-listings-list");
  const emptyState = document.getElementById("seller-listings-empty");
  container.innerHTML = "";

  if (sellerItems.length === 0) {
    emptyState.style.display = "flex";
    return;
  }
  emptyState.style.display = "none";

  sellerItems.forEach(item => {
    const card = document.createElement("div");
    card.className = "item-card";
    
    let statusClass = "status-active";
    if (item.status === "Pending Approval") statusClass = "status-pending";
    else if (item.status === "Sold") statusClass = "status-sold";
    else if (item.status === "Rejected") statusClass = "status-rejected";

    card.innerHTML = `
      <img src="${item.photos[0] || 'https://picsum.photos/seed/placeholder/300/300'}" class="item-card-image" alt="${item.name}">
      <div class="item-card-details">
        <div class="item-card-header">
          <div>
            <div class="item-card-name">${item.name}</div>
            <div class="item-card-price">${item.price} Birr</div>
          </div>
          <span class="badge ${statusClass}">${item.status}</span>
        </div>
        <div class="item-card-meta">
          <span>Size: ${item.size}</span>
          <span>Loc: ${item.location}</span>
        </div>
        <div class="item-card-badges" style="justify-content: flex-end;">
          ${item.status === 'Active' ? `
            <button class="btn-text" onclick="event.stopPropagation(); markAsSold('${item.itemId}')">Mark as Sold</button>
          ` : ''}
        </div>
      </div>
    `;

    // Only allow details view/edit if active or sold
    card.addEventListener("click", () => {
      AppState.selectedItem = item;
      navigateTo('screen-detail');
      renderItemDetail(item);
    });

    container.appendChild(card);
  });
}

// User Action: Mark Item as Sold
async function markAsSold(itemId) {
  if (confirm("Are you sure you want to mark this item as sold? This cannot be undone.")) {
    const item = AppState.items.find(i => i.itemId === itemId);
    if (!item) return;
    
    item.status = 'Sold';
    item.soldDate = Date.now();
    await DB.saveItem(item);
    
    // Increment exchanges for seller
    if (AppState.currentSeller) {
      AppState.currentSeller.exchangesCount = (AppState.currentSeller.exchangesCount || 0) + 1;
      await DB.saveSeller(AppState.currentSeller);
    }
    
    // Update local state items
    await refreshStateItems();
    showToast("Item marked as Sold!");
    checkSellerStatusAndLoadDashboard();
  }
}
window.markAsSold = markAsSold;

// Render My Account Screen
async function renderAccountScreen() {
  if (!AppState.currentUser) return;

  document.getElementById("user-avatar-placeholder").textContent = (AppState.currentUser.first_name || 'U').substring(0, 1).toUpperCase();
  document.getElementById("account-user-name").textContent = `${AppState.currentUser.first_name} ${AppState.currentUser.last_name || ''}`.trim();
  document.getElementById("account-user-handle").textContent = AppState.currentUser.username ? `@${AppState.currentUser.username}` : "No username set";

  // Check seller status
  const seller = await DB.getSellerById(AppState.currentUser.id);
  const statusBadge = document.getElementById("account-seller-status");
  const actionContainer = document.getElementById("account-onboarding-action");

  if (!seller) {
    statusBadge.textContent = "Not Applied";
    statusBadge.className = "badge badge-seller";
    actionContainer.innerHTML = `<button class="btn btn-primary" style="width: 100%;" onclick="navigateTo('screen-apply-seller')">Apply to Swap & Sell</button>`;
  } else {
    statusBadge.textContent = seller.status;
    statusBadge.className = "badge";
    
    if (seller.status === "Pending") {
      statusBadge.classList.add("status-pending");
      actionContainer.innerHTML = `<p style="font-size: 13px; text-align: center; color: var(--text-secondary);">Your application is being reviewed. We will notify you shortly.</p>`;
    } else if (seller.status === "Active" || seller.status === "Verified" || seller.status === "Top Contributor") {
      statusBadge.classList.add("status-active");
      actionContainer.innerHTML = `<button class="btn btn-secondary" style="width: 100%;" onclick="navigateTo('screen-seller-dashboard')">Open Seller Dashboard</button>`;
    } else if (seller.status === "Banned") {
      statusBadge.classList.add("status-rejected");
      actionContainer.innerHTML = `<p style="font-size: 13px; text-align: center; color: var(--badge-fair-text);">Your seller account has been banned due to policy violations.</p>`;
    }
  }

  // Developer Admin Dashboard access button
  const adminContainer = document.getElementById("admin-panel-link-container");
  if (AppState.isAdminMode) {
    adminContainer.style.display = "block";
  } else {
    adminContainer.style.display = "none";
  }
}

// --- 6. PHOTO ATTACHMENT FLOW ---
function handleFileSelect(event, idx) {
  const file = event.target.files[0];
  if (!file) return;

  // Add indicator
  const card = document.getElementById(`upload-card-${idx}`);
  card.innerHTML = `<i data-lucide="loader-2" class="spin" style="animation: spin 1s linear infinite;"></i>`;
  lucide.createIcons();

  // Load image on card to preview
  const reader = new FileReader();
  reader.onload = function(e) {
    AppState.photosToUpload[idx] = file;
    
    card.innerHTML = `
      <img src="${e.target.result}" alt="Preview">
      <button class="photo-delete-btn" onclick="event.stopPropagation(); deletePhotoInput(${idx})">
        <i data-lucide="x"></i>
      </button>
    `;
    lucide.createIcons();
    
    // Show next camera card if we have not reached limit of 5
    if (idx < 4) {
      const nextCard = document.getElementById(`upload-card-${idx + 1}`);
      nextCard.style.display = "flex";
    }
  };
  reader.readAsDataURL(file);
}

function deletePhotoInput(idx) {
  AppState.photosToUpload.splice(idx, 1);
  
  // Re-flow elements
  for (let i = 0; i < 5; i++) {
    const card = document.getElementById(`upload-card-${i}`);
    const fileInput = document.getElementById(`file-input-${i}`);
    
    if (AppState.photosToUpload[i]) {
      // populate with preview
      const file = AppState.photosToUpload[i];
      const url = URL.createObjectURL(file);
      card.innerHTML = `
        <img src="${url}" alt="Preview">
        <button class="photo-delete-btn" onclick="event.stopPropagation(); deletePhotoInput(${i})">
          <i data-lucide="x"></i>
        </button>
      `;
      card.style.display = "flex";
    } else {
      // empty camera icon
      card.innerHTML = `
        <i data-lucide="camera"></i>
        <input type="file" id="file-input-${i}" accept="image/*" style="display: none;" onchange="handleFileSelect(event, ${i})">
      `;
      // Show first empty slot, hide subsequent empty slots
      if (i === 0 || AppState.photosToUpload[i - 1]) {
        card.style.display = "flex";
      } else {
        card.style.display = "none";
      }
    }
  }
  lucide.createIcons();
}

// --- 7. ADMIN DASHBOARD CONTROL ---
function switchAdminTab(tabName) {
  AppState.currentAdminTab = tabName;
  document.querySelectorAll('.admin-tab').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');

  // Activate Tab Header
  const activeBtn = Array.from(document.querySelectorAll('.admin-tab')).find(btn => 
    btn.getAttribute('onclick').includes(tabName)
  );
  if (activeBtn) activeBtn.classList.add('active');

  // Activate content section
  const contentSection = document.getElementById(`admin-${tabName}`);
  if (contentSection) contentSection.style.display = 'block';

  renderAdminPanel();
}

let selectedAdminPreviewItem = null;

async function renderAdminPanel() {
  if (AppState.currentAdminTab === 'pending-items') {
    const pendingItems = AppState.items.filter(item => item.status === 'Pending Approval');
    const tableBody = document.querySelector("#admin-pending-items-table tbody");
    const emptyState = document.getElementById("admin-pending-items-empty");
    const previewBox = document.getElementById("admin-item-preview-box");
    tableBody.innerHTML = "";
    previewBox.style.display = "none";

    if (pendingItems.length === 0) {
      emptyState.style.display = "flex";
      return;
    }
    emptyState.style.display = "none";

    pendingItems.forEach(item => {
      const row = document.createElement("tr");
      row.style.cursor = "pointer";
      row.innerHTML = `
        <td><strong>${item.itemId}</strong></td>
        <td>${item.name}</td>
        <td>${item.price} Birr</td>
        <td>${item.sellerName}</td>
        <td>
          <button class="admin-action-btn admin-action-approve" onclick="event.stopPropagation(); approveItemAdmin('${item.itemId}')">OK</button>
        </td>
      `;
      row.addEventListener("click", () => showAdminPreview(item));
      tableBody.appendChild(row);
    });

  } else if (AppState.currentAdminTab === 'pending-sellers') {
    const sellers = await DB.getAllSellers();
    const pendingSellers = sellers.filter(s => s.status === 'Pending');
    const tableBody = document.querySelector("#admin-pending-sellers-table tbody");
    const emptyState = document.getElementById("admin-pending-sellers-empty");
    tableBody.innerHTML = "";

    if (pendingSellers.length === 0) {
      emptyState.style.display = "flex";
      return;
    }
    emptyState.style.display = "none";

    pendingSellers.forEach(seller => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>@${seller.telegramUsername || '-'}</td>
        <td>${seller.fullName}</td>
        <td>${seller.phone || '-'}</td>
        <td>${seller.location}</td>
        <td class="admin-action-btns">
          <button class="admin-action-btn admin-action-approve" onclick="approveSellerAdmin('${seller.telegramId}')">Approve</button>
          <button class="admin-action-btn admin-action-reject" onclick="rejectSellerAdmin('${seller.telegramId}')">Reject</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

  } else if (AppState.currentAdminTab === 'all-items') {
    const tableBody = document.querySelector("#admin-all-items-table tbody");
    tableBody.innerHTML = "";
    
    const searchVal = document.getElementById("admin-search-items").value.toLowerCase().trim();
    const statusVal = document.getElementById("admin-filter-status").value;

    let list = AppState.items;
    if (searchVal) {
      list = list.filter(i => i.name.toLowerCase().includes(searchVal) || i.itemId.toLowerCase().includes(searchVal));
    }
    if (statusVal) {
      list = list.filter(i => i.status === statusVal);
    }

    list.forEach(item => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.itemId}</td>
        <td>${item.name}</td>
        <td>${item.price} Birr</td>
        <td><span class="badge badge-status ${item.status === 'Active' ? 'status-active' : item.status === 'Sold' ? 'status-sold' : item.status === 'Rejected' ? 'status-rejected' : 'status-pending'}">${item.status}</span></td>
        <td>
          <button class="admin-action-btn admin-action-approve" onclick="toggleItemStatusAdmin('${item.itemId}')">Toggle Sold</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

  } else if (AppState.currentAdminTab === 'all-sellers') {
    const sellers = await DB.getAllSellers();
    const tableBody = document.querySelector("#admin-all-sellers-table tbody");
    tableBody.innerHTML = "";

    sellers.forEach(s => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>@${s.telegramUsername || '-'}</td>
        <td>${s.fullName}</td>
        <td>${s.exchangesCount || 0}</td>
        <td><span class="badge badge-status ${s.status === 'Banned' ? 'status-rejected' : 'status-active'}">${s.status}</span></td>
        <td>
          <button class="admin-action-btn admin-action-reject" onclick="toggleSellerStatusAdmin('${s.telegramId}')">${s.status === 'Banned' ? 'Unban' : 'Ban'}</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

  } else if (AppState.currentAdminTab === 'stats') {
    const total = AppState.items.length;
    const sold = AppState.items.filter(i => i.status === 'Sold').length;
    const pending = AppState.items.filter(i => i.status === 'Pending Approval').length;
    
    const sellers = await DB.getAllSellers();
    const activeSellers = sellers.filter(s => s.status !== 'Pending' && s.status !== 'Banned').length;

    document.getElementById("admin-stat-total-items").textContent = total;
    document.getElementById("admin-stat-sold-items").textContent = sold;
    document.getElementById("admin-stat-active-sellers").textContent = activeSellers;
    document.getElementById("admin-stat-pending-approval").textContent = pending;
  }
}

// Side preview card helper
function showAdminPreview(item) {
  selectedAdminPreviewItem = item;
  const box = document.getElementById("admin-item-preview-box");
  box.style.display = "block";

  document.getElementById("admin-preview-title").textContent = item.name;
  document.getElementById("admin-preview-meta").textContent = `${item.primaryCategory} / Size ${item.size} / ${item.location}`;
  document.getElementById("admin-preview-desc").textContent = item.description;
  document.getElementById("admin-preview-flaws").textContent = item.flaws || "None";

  // Images
  const imgRow = document.getElementById("admin-preview-images");
  imgRow.innerHTML = "";
  if (item.photos && item.photos.length > 0) {
    item.photos.forEach(photo => {
      const img = document.createElement("img");
      img.className = "admin-preview-img";
      img.src = photo;
      imgRow.appendChild(img);
    });
  } else {
    imgRow.innerHTML = `<p>No images</p>`;
  }

  // Setup preview actions
  document.getElementById("admin-preview-approve").replaceWith(document.getElementById("admin-preview-approve").cloneNode(true));
  document.getElementById("admin-preview-reject").replaceWith(document.getElementById("admin-preview-reject").cloneNode(true));
  
  document.getElementById("admin-preview-approve").addEventListener("click", () => {
    approveItemAdmin(item.itemId);
  });
  document.getElementById("admin-preview-reject").addEventListener("click", () => {
    rejectItemAdmin(item.itemId);
  });
}

// Admin approve/reject listings
async function approveItemAdmin(itemId) {
  const item = AppState.items.find(i => i.itemId === itemId);
  if (!item) return;

  const previousStatus = item.status;
  item.status = 'Active';
  await DB.saveItem(item);
  await refreshStateItems();
  showToast(`Item ${itemId} Approved!`);
  renderAdminPanel();

  if (previousStatus === 'Pending Approval') {
    postItemToTelegramChannel(item).catch(err => {
      console.error('Telegram post failed', err);
      showToast(`Item approved. Channel post failed: ${err.message || 'unknown error'}`);
    });
  }
}

async function rejectItemAdmin(itemId) {
  const item = AppState.items.find(i => i.itemId === itemId);
  if (!item) return;

  item.status = 'Rejected';
  await DB.saveItem(item);
  await refreshStateItems();
  
  showToast(`Item ${itemId} Rejected.`);
  renderAdminPanel();
}

// Admin approve/reject sellers
async function approveSellerAdmin(telegramId) {
  const seller = await DB.getSellerById(telegramId);
  if (!seller) return;

  seller.status = 'Active';
  await DB.saveSeller(seller);
  
  showToast("Seller Approved!");
  renderAdminPanel();
}

async function rejectSellerAdmin(telegramId) {
  const seller = await DB.getSellerById(telegramId);
  if (!seller) return;

  seller.status = 'Banned';
  await DB.saveSeller(seller);
  
  showToast("Application Rejected.");
  renderAdminPanel();
}

// Toggle operations
async function toggleItemStatusAdmin(itemId) {
  const item = AppState.items.find(i => i.itemId === itemId);
  if (!item) return;

  if (item.status === 'Active') {
    item.status = 'Sold';
    item.soldDate = Date.now();
  } else if (item.status === 'Sold') {
    item.status = 'Active';
    item.soldDate = null;
  }
  await DB.saveItem(item);
  await refreshStateItems();
  renderAdminPanel();
}

async function toggleSellerStatusAdmin(telegramId) {
  const seller = await DB.getSellerById(telegramId);
  if (!seller) return;

  seller.status = seller.status === 'Banned' ? 'Active' : 'Banned';
  await DB.saveSeller(seller);
  
  showToast("Seller Status Toggled.");
  renderAdminPanel();
}

// --- 8. STATE SYNCHRONIZER ---
async function refreshStateItems() {
  AppState.items = await DB.getItems();
}

// --- 9. EVENT BINDING & FORMS ---
function bindFormListeners() {
  
  // Search Text Input
  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", (e) => {
    AppState.filters.search = e.target.value;
    renderBrowseFeed();
  });

  // Filter Expand Button
  const filterToggle = document.getElementById("filter-toggle");
  const filterDrawer = document.getElementById("filter-drawer");
  filterToggle.addEventListener("click", () => {
    filterDrawer.classList.toggle("open");
  });

  // Price range slider display updater
  const priceSlider = document.getElementById("filter-price-max");
  const priceDisplay = document.getElementById("price-max-display");
  priceSlider.addEventListener("input", (e) => {
    priceDisplay.textContent = `${Number(e.target.value).toLocaleString()} Birr`;
  });

  // Apply filters button
  document.getElementById("filter-apply-btn").addEventListener("click", () => {
    AppState.filters.category = document.getElementById("filter-category").value;
    AppState.filters.size = document.getElementById("filter-size").value;
    AppState.filters.location = document.getElementById("filter-location").value;
    AppState.filters.priceMax = Number(priceSlider.value);
    
    // Condition check box pills
    const activeConds = [];
    if (document.getElementById("cond-new").checked) activeConds.push("New");
    if (document.getElementById("cond-likenew").checked) activeConds.push("Like New");
    if (document.getElementById("cond-good").checked) activeConds.push("Good");
    if (document.getElementById("cond-fair").checked) activeConds.push("Fair");
    AppState.filters.conditions = activeConds;

    renderBrowseFeed();
    filterDrawer.classList.remove("open");
    showToast("Filters applied.");
  });

  // Date filter pills (inside filter drawer)
  const dateRow = document.getElementById('filter-date-row');
  function updateDatePills() {
    if (!dateRow) return;
    const pills = dateRow.querySelectorAll('.date-pill');
    pills.forEach(p => {
      p.classList.toggle('active', p.dataset.range === AppState.filters.dateRange);
    });
  }

  if (dateRow) {
    dateRow.addEventListener('click', (e) => {
      const pill = e.target.closest('.date-pill');
      if (!pill) return;
      AppState.filters.dateRange = pill.dataset.range;
      updateDatePills();
      renderBrowseFeed();
    });
    // Ensure default
    if (!AppState.filters.dateRange) AppState.filters.dateRange = 'recent';
    updateDatePills();
  }

  // Reset Filters Button
  document.getElementById("filter-reset-btn").addEventListener("click", () => {
    document.getElementById("filter-category").value = "";
    document.getElementById("filter-size").value = "";
    document.getElementById("filter-location").value = "";
    priceSlider.value = 10000;
    priceDisplay.textContent = "10,000 Birr";
    
    document.getElementById("cond-new").checked = false;
    document.getElementById("cond-likenew").checked = false;
    document.getElementById("cond-good").checked = false;
    document.getElementById("cond-fair").checked = false;
    AppState.filters = {
      search: searchInput.value,
      category: '',
      size: '',
      location: '',
      conditions: [],
      priceMax: 10000,
      dateRange: 'recent'
    };
    // refresh date pills UI
    if (document.getElementById('filter-date-row')) {
      const pills = document.getElementById('filter-date-row').querySelectorAll('.date-pill');
      pills.forEach(p => p.classList.toggle('active', p.dataset.range === 'recent'));
    }
    renderBrowseFeed();
    filterDrawer.classList.remove("open");
    showToast("Filters reset.");
  });

  // Dashboard Button Link to list new item
  document.getElementById("dash-list-new-btn").addEventListener("click", () => {
    // Reset file uploads
    AppState.photosToUpload = [];
    deletePhotoInput(0);
    document.getElementById("add-listing-form").reset();
    navigateTo('screen-add-listing');
  });

  // Seller Onboarding Application Form Submit Handler
  document.getElementById("seller-application-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("submit-application-btn");
    btn.disabled = true;
    
    const fullName = document.getElementById("apply-name").value.trim();
    const phone = document.getElementById("apply-phone").value.trim();
    const location = document.getElementById("apply-location").value;
    const initialCount = Number(document.getElementById("apply-initial-count").value);
    const expYes = document.getElementById("exp-yes").checked;
    
    if (!fullName || !phone || !location) {
      showToast("Please fill in all required fields.");
      btn.disabled = false;
      return;
    }

    const sellerObj = {
      telegramId: AppState.currentUser.id,
      telegramUsername: AppState.currentUser.username || "",
      fullName,
      phone,
      location,
      status: "Pending",
      exchangesCount: 0,
      rating: 5.0,
      joinedDate: Date.now(),
      itemsListed: 0
    };

    await DB.saveSeller(sellerObj);
    showToast("Application submitted for admin review.");
    btn.disabled = false;
    
    // Redirect home / account
    navigateTo('screen-account');
  });

  // Add Listing Form Submit Handler
  document.getElementById("add-listing-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("submit-listing-btn");
    btn.disabled = true;

    const name = document.getElementById("add-name").value.trim();
    const primaryCategory = document.getElementById("add-category").value;
    const subcategory = document.getElementById("add-subcategory").value.trim();
    const brand = document.getElementById("add-brand").value.trim();
    const size = document.getElementById("add-size").value.trim();
    const price = Number(document.getElementById("add-price").value);
    const location = document.getElementById("add-location").value;
    const description = document.getElementById("add-description").value.trim();
    const flaws = document.getElementById("add-flaws").value.trim() || "None";
    const reasonForSelling = document.getElementById("add-reason").value.trim();

    // Verify condition selection
    let condition = "Like New";
    if (document.getElementById("cond-select-new").checked) condition = "New";
    else if (document.getElementById("cond-select-good").checked) condition = "Good";
    else if (document.getElementById("cond-select-fair").checked) condition = "Fair";

    // Upload Photos
    if (AppState.photosToUpload.length === 0) {
      showToast("At least 1 photo is required.");
      btn.disabled = false;
      return;
    }

    showToast("Compressing and uploading images...");
    const photoUrls = [];
    
    try {
      for (let i = 0; i < AppState.photosToUpload.length; i++) {
        const file = AppState.photosToUpload[i];
        if (file) {
          const url = await DB.uploadPhoto(file);
          photoUrls.push(url);
        }
      }
    } catch(err) {
      console.error("Photo upload failed: ", err);
      showToast("Image upload failed. Storing offline preview.");
      photoUrls.push("https://picsum.photos/seed/placeholder/600/600");
    }

    const nextId = await DB.getNextItemId();

    const newItem = {
      itemId: nextId,
      name,
      primaryCategory,
      subcategory,
      brand,
      size,
      condition,
      price,
      location,
      description,
      flaws,
      reasonForSelling,
      photos: photoUrls,
      sellerId: AppState.currentUser.id,
      sellerName: AppState.currentSeller ? AppState.currentSeller.fullName : AppState.currentUser.first_name,
      sellerUsername: AppState.currentUser.username || "",
      sellerStatus: AppState.currentSeller ? `${AppState.currentSeller.status} Seller` : "New Seller",
      sellerExchanges: AppState.currentSeller ? AppState.currentSeller.exchangesCount : 0,
      status: "Pending Approval",
      listedDate: Date.now(),
      soldDate: null
    };

    await DB.saveItem(newItem);
    
    // update seller listing counter
    if (AppState.currentSeller) {
      AppState.currentSeller.itemsListed = (AppState.currentSeller.itemsListed || 0) + 1;
      await DB.saveSeller(AppState.currentSeller);
    }

    await refreshStateItems();
    showToast("Listing submitted for review.");
    btn.disabled = false;
    navigateTo('screen-seller-dashboard');
  });

  // Simulate Admin Badge toggle in Header
  const devToggle = document.getElementById("dev-admin-toggle");
  devToggle.addEventListener("click", () => {
    AppState.isAdminMode = !AppState.isAdminMode;
    devToggle.classList.toggle("active", AppState.isAdminMode);
    
    if (AppState.isAdminMode) {
      showToast("Simulated Admin Mode Active.");
    } else {
      showToast("Simulated Admin Mode Inactive.");
      if (AppState.activeScreen === 'screen-admin') {
        navigateTo('screen-browse');
      }
    }
    
    // Refresh Account links
    if (AppState.activeScreen === 'screen-account') {
      renderAccountScreen();
    }
  });

  // Account Screen: Go to admin page
  document.getElementById("admin-go-btn").addEventListener("click", () => {
    navigateTo('screen-admin');
  });

  // Search Items in Admin Panel
  document.getElementById("admin-search-items").addEventListener("input", () => {
    renderAdminPanel();
  });
  document.getElementById("admin-filter-status").addEventListener("change", () => {
    renderAdminPanel();
  });
}

// --- 10. APP INITIALIZER & BOOTSTRAP ---
async function bootstrap() {
  Telegram.WebApp.ready();
  Telegram.WebApp.expand();

  // Color Scheme handler
  const isDark = Telegram.WebApp.colorScheme === 'dark';
  document.body.classList.toggle('dark', isDark);
  document.getElementById("theme-scheme-display").textContent = isDark ? "Dark Mode" : "Light Mode";

  // Capture user info
  let user = Telegram.WebApp.initDataUnsafe.user;
  if (!user || !user.id) {
    // Development mockup user outside TG
    user = {
      id: "dev_tester_123",
      username: "addis_tester",
      first_name: "Abebe",
      last_name: "Bikila"
    };
    console.log("No Telegram WebApp user detected, initialized dev tester.");
  }
  AppState.currentUser = user;

  // Initialize data collections
  await refreshStateItems();

  // Create Lucide Icons
  lucide.createIcons();

  // Bind all interactive elements
  bindFormListeners();

  // Render main screen
  renderBrowseFeed();
  
  console.log("Addis Closet Swap Mini App initialized.");
}

// Start
document.addEventListener("DOMContentLoaded", bootstrap);
