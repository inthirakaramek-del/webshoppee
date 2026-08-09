// LA MAISON - Application Controller
// Manages Routing, State, Real-time Subscriptions, Search, and Admin Operations

// --- CONFIGURATION & INITIALIZATION ---
let supabaseClient = null;
let collectionsState = [];
let productsState = [];
let adminLoggedIn = sessionStorage.getItem('la_maison_admin') === 'true';

// Check if credentials are set
const isConfigured = 
  typeof CONFIG !== 'undefined' && 
  CONFIG.SUPABASE_URL && 
  CONFIG.SUPABASE_ANON_KEY && 
  CONFIG.SUPABASE_URL !== 'YOUR_SUPABASE_PROJECT_URL' && 
  CONFIG.SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

if (isConfigured) {
  // Resolve raw project ID (e.g. kfxjglkekkhzeaydnvfr) into full Supabase URL if needed
  let resolvedUrl = CONFIG.SUPABASE_URL.trim();
  if (!resolvedUrl.startsWith('http://') && !resolvedUrl.startsWith('https://')) {
    resolvedUrl = `https://${resolvedUrl}.supabase.co`;
  }
  
  // Initialize Supabase Client
  supabaseClient = supabase.createClient(resolvedUrl, CONFIG.SUPABASE_ANON_KEY);
} else {
  // Show Warning Banner
  document.getElementById('config-alert').classList.remove('hidden');
  console.warn("Supabase credentials missing or set to defaults in config.js");
}

// --- STATE VARIABLES ---
let currentRoute = 'home';
let activeCollectionId = null;
let activeCategoryFilter = 'All';
let searchQuery = '';
let settingsState = {};
let previewMode = false;

// --- EVENT LISTENERS (ON INITIAL LOAD) ---
document.addEventListener('DOMContentLoaded', () => {
  if (!supabaseClient) return; // Exit if not configured

  // Setup Routing
  window.addEventListener('hashchange', handleRoute);
  handleRoute(); // Call once on start

  // Fetch initial data
  fetchInitialData();

  // Setup Real-time Listeners
  setupRealtimeSubscriptions();

  // Bind Preview Toggle Button
  const previewToggleBtn = document.getElementById('preview-toggle-btn');
  if (previewToggleBtn) {
    previewToggleBtn.addEventListener('click', () => {
      previewMode = !previewMode;
      previewToggleBtn.textContent = previewMode ? "Admin View" : "Preview Site";
      previewToggleBtn.className = previewMode 
        ? "bg-white text-black px-2 py-0.5 text-[9px] uppercase tracking-widest font-semibold rounded-sm border border-white" 
        : "border border-white/20 hover:border-white px-2 py-0.5 text-[9px] uppercase tracking-widest text-zinc-400 hover:text-white transition-all rounded-none bg-transparent";
      
      // Re-render current route to hide/show edit buttons
      if (currentRoute === 'home') renderHome();
      if (currentRoute === 'collection') renderCollectionDetail();
      if (currentRoute === 'category') renderCategoryDetail();
    });
  }

  // Bind Search Input
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search');
  
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toUpperCase();
    if (searchQuery.length > 0) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }
    // Search is executed by filtering home view
    if (window.location.hash !== '#home' && window.location.hash !== '') {
      window.location.hash = '#home'; // Redirect to home/search view
    } else {
      renderHome();
    }
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    renderHome();
  });

  // Bind Admin Auth Form
  document.getElementById('admin-login-form').addEventListener('submit', handleAdminLogin);
  document.getElementById('admin-logout-btn').addEventListener('click', handleAdminLogout);

  // Hidden Trigger 1: Triple-clicking logo
  let logoClicks = 0;
  let logoClickTimeout;
  const logo = document.querySelector('a.brand-logo');
  if (logo) {
    logo.addEventListener('click', (e) => {
      if (adminLoggedIn) return; // Normal hash navigation to #home if already admin
      
      logoClicks++;
      clearTimeout(logoClickTimeout);
      if (logoClicks >= 3) {
        logoClicks = 0;
        e.preventDefault();
        window.location.hash = '#admin';
      } else {
        logoClickTimeout = setTimeout(() => { logoClicks = 0; }, 1000);
      }
    });
  }

  // Hidden Trigger 2: Alt + Shift + A Key shortcut
  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && e.code === 'KeyA') {
      e.preventDefault();
      window.location.hash = '#admin';
    }
  });

  // Update header indicator
  updateAdminUIState();

  // Bind Modals & Form Actions
  setupModalBindings();
});

// --- CORE UTILITIES ---
function showSyncIndicator() {
  const sync = document.getElementById('sync-indicator');
  sync.classList.remove('opacity-0');
  sync.classList.add('opacity-100');
  setTimeout(() => {
    sync.classList.remove('opacity-100');
    sync.classList.add('opacity-0');
  }, 2000);
}

function updateAdminUIState() {
  const badge = document.getElementById('admin-indicator');
  const navAdmin = document.getElementById('nav-admin');
  const navSeparator = document.getElementById('nav-admin-separator');
  const previewToggleBtn = document.getElementById('preview-toggle-btn');
  
  if (adminLoggedIn) {
    badge.classList.remove('hidden');
    navAdmin.classList.remove('hidden');
    if (navSeparator) navSeparator.classList.remove('hidden');
    if (previewToggleBtn) previewToggleBtn.classList.remove('hidden');
    navAdmin.textContent = "Workspace";
  } else {
    badge.classList.add('hidden');
    navAdmin.classList.add('hidden');
    if (navSeparator) navSeparator.classList.add('hidden');
    if (previewToggleBtn) previewToggleBtn.classList.add('hidden');
    navAdmin.textContent = "Admin Dashboard";
  }
}

// --- DATA ACCESS LAYER ---
let pageVisitsState = 0;

async function fetchInitialData() {
  await Promise.all([
    fetchCollections(),
    fetchProducts(),
    fetchSettings()
  ]);
  
  // Re-render current page once initial data arrives
  handleRoute();
}

async function fetchSettings() {
  try {
    const { data, error } = await supabaseClient
      .from('settings')
      .select('*');
    if (error) throw error;
    
    settingsState = {};
    data.forEach(item => {
      settingsState[item.key] = item.value;
    });
    
    renderSettings();
  } catch (err) {
    console.error("Error fetching settings:", err.message);
  }
}

function renderSettings() {
  const heroTitle = document.getElementById('hero-banner-title');
  const heroSubtitle = document.getElementById('hero-banner-subtitle');
  const heroImage = document.getElementById('hero-banner-image');
  const tiktokLink = document.getElementById('hero-tiktok-link');
  const lemon8Link = document.getElementById('hero-lemon8-link');

  if (heroTitle && settingsState['hero_title']) heroTitle.textContent = settingsState['hero_title'];
  if (heroSubtitle && settingsState['hero_subtitle']) heroSubtitle.textContent = settingsState['hero_subtitle'];
  if (heroImage && settingsState['hero_image']) {
    heroImage.style.backgroundImage = `url('${settingsState['hero_image']}')`;
  }
  if (tiktokLink && settingsState['tiktok_link']) tiktokLink.href = settingsState['tiktok_link'];
  if (lemon8Link && settingsState['lemon8_link']) lemon8Link.href = settingsState['lemon8_link'];

  // Fill admin inputs if logged in
  const inputTitle = document.getElementById('setting-hero-title');
  const inputSubtitle = document.getElementById('setting-hero-subtitle');
  const inputImage = document.getElementById('setting-hero-image');
  const inputTiktok = document.getElementById('setting-tiktok-link');
  const inputLemon8 = document.getElementById('setting-lemon8-link');

  if (inputTitle) inputTitle.value = settingsState['hero_title'] || '';
  if (inputSubtitle) inputSubtitle.value = settingsState['hero_subtitle'] || '';
  if (inputImage) inputImage.value = settingsState['hero_image'] || '';
  if (inputTiktok) inputTiktok.value = settingsState['tiktok_link'] || '';
  if (inputLemon8) inputLemon8.value = settingsState['lemon8_link'] || '';
}

async function fetchCollections() {
  try {
    const { data, error } = await supabaseClient
      .from('collections')
      .select('*')
      .order('title', { ascending: true });
    
    if (error) throw error;
    collectionsState = data || [];
    populateCollectionDropdowns();
  } catch (error) {
    console.error('Error fetching collections:', error.message);
  }
}

async function fetchProducts() {
  try {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) throw error;
    productsState = data || [];
  } catch (error) {
    console.error('Error fetching products:', error.message);
  }
}

async function trackAndFetchPageViews() {
  try {
    // 1. Fetch current view count
    const { data, error } = await supabaseClient
      .from('page_visits')
      .select('count')
      .eq('id', 'home')
      .single();

    if (error) throw error;

    let currentCount = data ? data.count : 0;

    // 2. Only increment if NOT admin, and not tracked in this session
    const isTracked = sessionStorage.getItem('la_maison_tracked') === 'true';
    if (!adminLoggedIn && !isTracked) {
      currentCount++;
      const { error: updateError } = await supabaseClient
        .from('page_visits')
        .update({ count: currentCount, updated_at: new Date().toISOString() })
        .eq('id', 'home');

      if (!updateError) {
        sessionStorage.setItem('la_maison_tracked', 'true');
      }
    }

    pageVisitsState = currentCount;
    updateStatsUI();
  } catch (error) {
    console.error('Error tracking page views:', error.message);
  }
}

function updateStatsUI() {
  const statCollections = document.getElementById('stat-collections-count');
  if (statCollections) statCollections.textContent = collectionsState.length;

  const statProducts = document.getElementById('stat-products-count');
  if (statProducts) statProducts.textContent = productsState.length;
}

// --- REALTIME MANAGER ---
function setupRealtimeSubscriptions() {
  // Subscribe to collections schema changes
  supabaseClient.channel('public:collections')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'collections' }, async (payload) => {
      console.log('Realtime Collections change:', payload);
      showSyncIndicator();
      await fetchCollections();
      
      // Update screens currently viewing collections
      if (currentRoute === 'home') renderHome();
      if (currentRoute === 'admin') renderAdminPanel();
    })
    .subscribe();

  // Subscribe to products schema changes
  supabaseClient.channel('public:products')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async (payload) => {
      console.log('Realtime Products change:', payload);
      showSyncIndicator();
      await fetchProducts();
      
      // Update screen viewing product lists
      if (currentRoute === 'home') renderHome();
      if (currentRoute === 'collection') renderCollectionDetail();
      if (currentRoute === 'category') renderCategoryDetail();
      if (currentRoute === 'admin') renderAdminPanel();
    })
    .subscribe();

  // Subscribe to page_visits schema changes
  supabaseClient.channel('public:page_visits')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'page_visits' }, (payload) => {
      console.log('Realtime Page Visits change:', payload);
      if (payload.new && payload.new.count !== undefined) {
        pageVisitsState = payload.new.count;
        updateStatsUI();
      }
    })
    .subscribe();

  // Subscribe to settings schema changes
  supabaseClient.channel('public:settings')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, async (payload) => {
      console.log('Realtime Settings change:', payload);
      showSyncIndicator();
      await fetchSettings();
    })
    .subscribe();
}

// --- ROUTER SYSTEM ---
function handleRoute() {
  const hash = window.location.hash || '#home';
  const pathParts = hash.split('/');
  
  // Hide all sections
  document.querySelectorAll('.route-section').forEach(sec => sec.classList.remove('active'));

  if (hash === '#home' || hash === '') {
    currentRoute = 'home';
    document.getElementById('route-home').classList.add('active');
    renderHome();
  } 
  else if (pathParts[0] === '#collection' && pathParts[1]) {
    currentRoute = 'collection';
    activeCollectionId = pathParts[1];
    activeCategoryFilter = 'All'; // Reset category tab
    document.getElementById('route-collection-detail').classList.add('active');
    renderCollectionDetail();
  } 
  else if (pathParts[0] === '#category' && pathParts[1]) {
    currentRoute = 'category';
    // Decode Thai characters that get URL-encoded in the hash
    activeCategoryFilter = decodeURIComponent(pathParts[1]);
    document.getElementById('route-category-detail').classList.add('active');
    renderCategoryDetail();
  }
  else if (hash === '#admin') {
    currentRoute = 'admin';
    document.getElementById('route-admin').classList.add('active');
    renderAdminRoute();
  }
  
  // Smooth scroll to top of page on change
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- VISITOR VIEW: RENDERING HOME / COLLECTION LIST ---
function renderHome() {
  const grid = document.getElementById('collections-grid');
  const searchHeader = document.getElementById('search-header-container');
  const searchQueryDisplay = document.getElementById('search-query-display');
  const heroBlock = document.querySelector('#route-home > div.mb-16');

  grid.innerHTML = '';

  if (searchQuery.length > 0) {
    // SEARCH MODE
    searchHeader.classList.remove('hidden');
    searchQueryDisplay.textContent = `"${searchQuery}"`;
    heroBlock.classList.add('hidden');

    // Filter collections and products matching search query
    const filteredCollections = collectionsState.filter(c => 
      c.title.toUpperCase().includes(searchQuery) || 
      (c.description && c.description.toUpperCase().includes(searchQuery))
    );

    const filteredProducts = productsState.filter(p => 
      p.name.toUpperCase().includes(searchQuery) || 
      p.category.toUpperCase().includes(searchQuery)
    );

    // If nothing found
    if (filteredCollections.length === 0 && filteredProducts.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center text-zinc-500 tracking-wider">
          <p class="text-sm">NO PRODUCTS OR COLLECTIONS MATCHING YOUR SEARCH FOUND.</p>
          <button onclick="document.getElementById('clear-search').click()" class="text-white hover:underline text-xs mt-4 uppercase">Reset Search</button>
        </div>
      `;
      return;
    }

    // Render Matching Collections
    filteredCollections.forEach(col => {
      grid.appendChild(createCollectionCard(col, true));
    });

    // Render Matching Products
    filteredProducts.forEach(prod => {
      grid.appendChild(createProductCard(prod, true));
    });

  } else {
    // DEFAULT COLLECTION LISTING MODE
    searchHeader.classList.add('hidden');
    heroBlock.classList.remove('hidden');

    if (collectionsState.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center text-zinc-500 tracking-wider text-sm">
          NO COLLECTIONS POSTED YET. CHECK BACK LATER.
        </div>
      `;
      return;
    }

    collectionsState.forEach(col => {
      grid.appendChild(createCollectionCard(col, false));
    });
  }
}

function createCollectionCard(col, isSearchMode = false) {
  const div = document.createElement('div');
  div.className = 'border border-white/5 aspect-[3/4] relative overflow-hidden flex flex-col justify-end p-8 bg-zinc-950 group hover-zoom animate-fade-in-up';
  
  // Background Image - full brightness, show true colors
  const imgDiv = document.createElement('div');
  imgDiv.className = 'absolute inset-0 bg-cover bg-center opacity-100 transition-opacity duration-500';
  imgDiv.style.backgroundImage = `url('${col.image}')`;
  
  // Overlay - ONLY dark at the very bottom (bottom 50%) where text sits, transparent above
  const overlay = document.createElement('div');
  overlay.className = 'absolute inset-0 bg-gradient-to-t from-black via-black/60 via-30% to-transparent to-60% z-10';

  // Details
  const content = document.createElement('div');
  content.className = 'relative z-20 flex flex-col';

  content.innerHTML = `
    ${isSearchMode ? `<span class="text-[9px] uppercase tracking-widest text-zinc-500 mb-1">Collection</span>` : ''}
    <h3 class="text-2xl font-light tracking-widest text-white uppercase mb-2 group-hover:text-zinc-200 transition-colors">${col.title}</h3>
    <p class="text-zinc-400 text-xs leading-relaxed font-light mb-6 line-clamp-2">${col.description || ''}</p>
    <div class="flex items-center justify-between">
      <a href="#collection/${col.id}" class="inline-flex items-center gap-2 text-white text-[10px] uppercase tracking-widest font-semibold hover-underline">
        Explore Collection
        <svg class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
      </a>
      ${(adminLoggedIn && !previewMode) ? `
        <button onclick="event.preventDefault(); openCollectionModal('${col.id}')" class="text-zinc-400 hover:text-white text-[10px] uppercase tracking-widest border border-white/10 hover:border-white/30 px-3 py-1 rounded bg-black/40">
          Edit
        </button>
      ` : ''}
    </div>
  `;

  div.appendChild(imgDiv);
  div.appendChild(overlay);
  div.appendChild(content);

  return div;
}

// --- VISITOR VIEW: RENDERING PRODUCT LIST WITHIN COLLECTION ---
function renderCollectionDetail() {
  const collection = collectionsState.find(c => c.id === activeCollectionId);
  const header = document.getElementById('collection-detail-header');
  const grid = document.getElementById('products-grid');

  if (!collection) {
    header.innerHTML = `<h2 class="text-xl uppercase tracking-widest text-zinc-500">Collection not found</h2>`;
    grid.innerHTML = '';
    return;
  }

  // Render Collection Info Header
  header.innerHTML = `
    <div class="flex items-center justify-between">
      <h2 class="text-4xl lg:text-5xl font-light tracking-widest text-white uppercase">${collection.title}</h2>
      ${(adminLoggedIn && !previewMode) ? `
        <button onclick="openCollectionModal('${collection.id}')" class="border border-white/20 hover:border-white text-white text-[10px] uppercase tracking-widest py-2 px-5 transition-colors">
          Manage Collection
        </button>
      ` : ''}
    </div>
    <p class="text-zinc-400 text-xs md:text-sm max-w-3xl leading-relaxed font-light mt-4 uppercase tracking-wider">${collection.description || 'Minimalist silhouette capsule'}</p>
  `;

  // Render Showcase Image: show image if available, show admin placeholder if admin & no image
  const showcaseImgDiv = document.getElementById('collection-showcase-img');
  const showcaseSrc = document.getElementById('collection-showcase-src');
  const showcasePlaceholder = document.getElementById('collection-showcase-placeholder');
  const showcaseContainer = document.getElementById('collection-showcase-container');

  if (collection.showcase_image) {
    // Has image — show it
    if (showcaseSrc) showcaseSrc.src = collection.showcase_image;
    if (showcaseImgDiv) showcaseImgDiv.classList.remove('hidden');
    if (showcasePlaceholder) showcasePlaceholder.classList.add('hidden');
    if (showcaseContainer) showcaseContainer.classList.remove('hidden');
  } else if (adminLoggedIn && !previewMode) {
    // No image, but admin — show placeholder with instruction
    if (showcaseImgDiv) showcaseImgDiv.classList.add('hidden');
    if (showcasePlaceholder) {
      showcasePlaceholder.classList.remove('hidden');
      showcasePlaceholder.onclick = () => openCollectionModal(collection.id);
    }
    if (showcaseContainer) showcaseContainer.classList.remove('hidden');
  } else {
    // No image, visitor — hide entire block
    if (showcaseContainer) showcaseContainer.classList.add('hidden');
  }

  // Show/hide Admin Action Bar (Add Product button)
  const adminBar = document.getElementById('collection-admin-bar');
  const addProductBtn = document.getElementById('collection-add-product-btn');
  if (adminBar && addProductBtn) {
    if (adminLoggedIn && !previewMode) {
      adminBar.classList.remove('hidden');
      // Pre-select this collection when opening product modal
      addProductBtn.onclick = () => {
        openProductModal(); // open blank modal
        // After modal opens, set the collection selector to current collection
        setTimeout(() => {
          const sel = document.getElementById('product-collection-select');
          if (sel) sel.value = activeCollectionId;
        }, 50);
      };
    } else {
      adminBar.classList.add('hidden');
    }
  }

  // Render Products matching collection
  grid.innerHTML = '';
  
  const filteredProducts = productsState.filter(p => p.collection_id === activeCollectionId);
  
  if (filteredProducts.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center text-zinc-500 tracking-wider text-xs">
        NO PIECES IN THE ${collection.title} YET.
      </div>
    `;
    return;
  }

  filteredProducts.forEach(prod => {
    grid.appendChild(createProductCard(prod, false));
  });
}

// --- VISITOR VIEW: RENDERING PRODUCT LIST WITHIN CATEGORY ---
function renderCategoryDetail() {
  const title = document.getElementById('category-detail-title');
  const grid = document.getElementById('category-products-grid');

  if (!title || !grid) return;

  // Set category title (e.g. TOPS)
  title.textContent = activeCategoryFilter.toUpperCase();

  grid.innerHTML = '';

  // Filter products by category across all collections
  const filteredProducts = productsState.filter(p => p.category === activeCategoryFilter);

  if (filteredProducts.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center text-zinc-500 tracking-wider text-sm">
        NO PIECES UNDER THE ${activeCategoryFilter.toUpperCase()} CATEGORY YET.
      </div>
    `;
    return;
  }

  filteredProducts.forEach(prod => {
    grid.appendChild(createProductCard(prod, true)); // pass true to display the collection name badge
  });
}

function createProductCard(prod, isSearchMode = false) {
  const col = collectionsState.find(c => c.id === prod.collection_id);
  const div = document.createElement('div');
  div.className = 'border border-white/5 bg-zinc-950/20 flex flex-col group relative animate-fade-in-up';
  
  // Price formatting
  const formattedPrice = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(prod.price);

  div.innerHTML = `
    <!-- Product Image Box -->
    <div class="aspect-square relative overflow-hidden bg-zinc-900 border-b border-white/5 hover-zoom">
      <img src="${prod.image}" alt="${prod.name}" class="w-full h-full object-cover">
      ${isSearchMode && col ? `
        <span class="absolute top-4 left-4 z-10 bg-black/75 border border-white/10 px-2 py-0.5 text-[9px] uppercase tracking-widest text-zinc-400">
          ${col.title}
        </span>
      ` : ''}
      <span class="absolute top-4 right-4 z-10 bg-white text-black px-2 py-0.5 text-[9px] uppercase tracking-widest font-semibold">
        ${prod.category}
      </span>
    </div>

    <!-- Product Details -->
    <div class="p-6 flex flex-col flex-grow justify-between">
      <div>
        <h4 class="text-sm font-medium tracking-wide text-white uppercase mb-1 line-clamp-1">${prod.name}</h4>
        <p class="text-xs text-zinc-400 tracking-wider">${formattedPrice}</p>
      </div>

      <div class="flex items-center gap-3 mt-6">
        <a 
          href="${prod.affiliate_link}" 
          target="_blank" 
          rel="noopener noreferrer" 
          class="flex-grow bg-white text-black text-center py-2.5 text-[10px] uppercase tracking-widest font-semibold hover:bg-zinc-200 transition-colors rounded-none"
        >
          Order Piece
        </a>
        ${(adminLoggedIn && !previewMode) ? `
          <button onclick="openProductModal('${prod.id}')" class="bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white px-3.5 py-2.5 text-[10px] uppercase tracking-wider rounded-none">
            Edit
          </button>
        ` : ''}
      </div>
    </div>
  `;

  return div;
}

// --- ADMIN DASHBOARD: ACCESS ROUTING ---
function renderAdminRoute() {
  const loginScreen = document.getElementById('admin-login-screen');
  const panel = document.getElementById('admin-panel');

  if (adminLoggedIn) {
    loginScreen.classList.add('hidden');
    panel.classList.remove('hidden');
    renderAdminPanel();
  } else {
    loginScreen.classList.remove('hidden');
    panel.classList.add('hidden');
    document.getElementById('admin-password-input').value = '';
    document.getElementById('login-error-msg').classList.add('hidden');
  }
}

// --- ADMIN AUTHENTICATION ---
function handleAdminLogin(e) {
  e.preventDefault();
  const password = document.getElementById('admin-password-input').value;
  const errorMsg = document.getElementById('login-error-msg');

  if (password === CONFIG.ADMIN_PASSWORD) {
    adminLoggedIn = true;
    sessionStorage.setItem('la_maison_admin', 'true');
    errorMsg.classList.add('hidden');
    updateAdminUIState();
    renderAdminRoute();
    
    // Refresh Home View so "edit" buttons render on cards
    fetchInitialData();
  } else {
    errorMsg.textContent = "INCORRECT AUTHORIZATION KEY. ACCESS DENIED.";
    errorMsg.classList.remove('hidden');
  }
}

function handleAdminLogout() {
  adminLoggedIn = false;
  sessionStorage.removeItem('la_maison_admin');
  updateAdminUIState();
  renderAdminRoute();
  
  // Refresh home view to hide edit buttons
  fetchInitialData();
}

// --- ADMIN PANELS: CRUD VIEW RENDERING ---
function renderAdminPanel() {
  const cCount = document.getElementById('collections-count');
  if (cCount) cCount.textContent = collectionsState.length;
  
  const pCount = document.getElementById('products-count');
  if (pCount) pCount.textContent = productsState.length;

  // Render stats counters card grid
  updateStatsUI();

  populateAdminCollectionsTable();
  populateAdminProductsTable();
}

// Populate collections table
function populateAdminCollectionsTable() {
  const body = document.getElementById('admin-collections-table-body');
  body.innerHTML = '';

  if (collectionsState.length === 0) {
    body.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-zinc-600 uppercase tracking-widest">No Collections Found</td></tr>`;
    return;
  }

  collectionsState.forEach(col => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-zinc-950/40";
    tr.innerHTML = `
      <td class="p-4 border-b border-white/5 w-24">
        <img src="${col.image}" alt="${col.title}" class="w-16 h-16 object-cover border border-white/5">
      </td>
      <td class="p-4 border-b border-white/5 font-semibold text-white tracking-wide uppercase">${col.title}</td>
      <td class="p-4 border-b border-white/5 text-zinc-400 max-w-sm truncate leading-relaxed font-light">${col.description || '-'}</td>
      <td class="p-4 border-b border-white/5 text-right w-36">
        <div class="flex items-center justify-end gap-2">
          <button onclick="openCollectionModal('${col.id}')" class="text-zinc-300 hover:text-white border border-white/10 hover:border-white/20 bg-zinc-900/50 px-3 py-1.5 rounded uppercase tracking-wider text-[10px]">Edit</button>
          <button onclick="deleteCollection('${col.id}', '${col.title}')" class="text-red-400 hover:text-red-300 border border-red-500/10 hover:border-red-500/20 bg-red-950/20 px-3 py-1.5 rounded uppercase tracking-wider text-[10px]">Delete</button>
        </div>
      </td>
    `;
    body.appendChild(tr);
  });
}

// Populate products table
function populateAdminProductsTable() {
  const body = document.getElementById('admin-products-table-body');
  const filterVal = document.getElementById('admin-product-filter-collection').value;
  body.innerHTML = '';

  let filtered = [...productsState];
  if (filterVal !== 'All') {
    filtered = filtered.filter(p => p.collection_id === filterVal);
  }

  if (filtered.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-zinc-600 uppercase tracking-widest">No Products Found</td></tr>`;
    return;
  }

  filtered.forEach(p => {
    const col = collectionsState.find(c => c.id === p.collection_id);
    const formattedPrice = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(p.price);
    
    const tr = document.createElement('tr');
    tr.className = "hover:bg-zinc-950/40";
    tr.innerHTML = `
      <td class="p-4 border-b border-white/5 w-24">
        <img src="${p.image}" alt="${p.name}" class="w-12 h-16 object-cover border border-white/5">
      </td>
      <td class="p-4 border-b border-white/5 font-semibold text-white tracking-wide uppercase">
        <div class="line-clamp-1">${p.name}</div>
        <a href="${p.affiliate_link}" target="_blank" class="text-[9px] text-zinc-500 lowercase hover:underline block leading-none mt-1">${p.affiliate_link}</a>
      </td>
      <td class="p-4 border-b border-white/5 text-zinc-400 uppercase tracking-wider text-[10px]">${col ? col.title : 'Unknown'}</td>
      <td class="p-4 border-b border-white/5 text-zinc-400 text-[10px] uppercase">${p.category}</td>
      <td class="p-4 border-b border-white/5 font-mono text-white text-[11px]">${formattedPrice}</td>
      <td class="p-4 border-b border-white/5 text-right w-36">
        <div class="flex items-center justify-end gap-2">
          <button onclick="openProductModal('${p.id}')" class="text-zinc-300 hover:text-white border border-white/10 hover:border-white/20 bg-zinc-900/50 px-3 py-1.5 rounded uppercase tracking-wider text-[10px]">Edit</button>
          <button onclick="deleteProduct('${p.id}', '${p.name}')" class="text-red-400 hover:text-red-300 border border-red-500/10 hover:border-red-500/20 bg-red-950/20 px-3 py-1.5 rounded uppercase tracking-wider text-[10px]">Delete</button>
        </div>
      </td>
    `;
    body.appendChild(tr);
  });
}

// Populate product modal dropdown and filter dropdown
function populateCollectionDropdowns() {
  const dropdown = document.getElementById('product-collection-select');
  const filterDropdown = document.getElementById('admin-product-filter-collection');

  // Save current values to restore them
  const currentVal = dropdown.value;
  const currentFilterVal = filterDropdown.value;

  dropdown.innerHTML = '';
  filterDropdown.innerHTML = '<option value="All">All Collections</option>';

  collectionsState.forEach(col => {
    // Fill product modal dropdown
    const option = document.createElement('option');
    option.value = col.id;
    option.textContent = col.title.toUpperCase();
    dropdown.appendChild(option);

    // Fill filter dropdown
    const filterOption = document.createElement('option');
    filterOption.value = col.id;
    filterOption.textContent = col.title.toUpperCase();
    filterDropdown.appendChild(filterOption);
  });

  // Restore values if still valid
  if (collectionsState.some(c => c.id === currentVal)) {
    dropdown.value = currentVal;
  }
  if (collectionsState.some(c => c.id === currentFilterVal) || currentFilterVal === 'All') {
    filterDropdown.value = currentFilterVal;
  }
}

// Helper function to upload files to Supabase Storage
async function uploadImageFile(file) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { data, error } = await supabaseClient.storage
    .from('fashion-images')
    .upload(filePath, file);

  if (error) throw error;

  const { data: urlData } = supabaseClient.storage
    .from('fashion-images')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

// Helper function to delete files from Supabase Storage
async function deleteImageFile(imageUrl) {
  if (!imageUrl) return;
  
  // Extract path if it is a Supabase public storage URL
  // format: https://<project>.supabase.co/storage/v1/object/public/fashion-images/uploads/filename.ext
  const storageIndicator = '/storage/v1/object/public/fashion-images/';
  if (imageUrl.includes(storageIndicator)) {
    const filePath = imageUrl.split(storageIndicator)[1];
    if (filePath) {
      try {
        const { error } = await supabaseClient.storage
          .from('fashion-images')
          .remove([filePath]);
        if (error) throw error;
        console.log("Successfully deleted file from storage:", filePath);
      } catch (err) {
        console.error("Failed to delete storage file:", err.message);
      }
    }
  }
}

// --- MODAL UTILITIES & FORM SUBMIT HANDLERS ---
function setupModalBindings() {
  // Bind toggles for admin dashboard Collections/Products/Settings view
  const toggleCollectionsBtn = document.getElementById('admin-toggle-collections');
  const toggleProductsBtn = document.getElementById('admin-toggle-products');
  const toggleSettingsBtn = document.getElementById('admin-toggle-settings');
  const collectionsSection = document.getElementById('admin-collections-sec');
  const productsSection = document.getElementById('admin-products-sec');
  const settingsSection = document.getElementById('admin-settings-sec');

  const selectTab = (activeTab) => {
    const activeClass = "bg-white text-black text-xs font-semibold px-6 py-2 uppercase tracking-widest transition-all";
    const inactiveClass = "text-zinc-500 hover:text-zinc-300 text-xs px-6 py-2 uppercase tracking-widest transition-all";

    toggleCollectionsBtn.className = activeTab === 'collections' ? activeClass : inactiveClass;
    toggleProductsBtn.className = activeTab === 'products' ? activeClass : inactiveClass;
    toggleSettingsBtn.className = activeTab === 'settings' ? activeClass : inactiveClass;

    collectionsSection.classList.toggle('hidden', activeTab !== 'collections');
    productsSection.classList.toggle('hidden', activeTab !== 'products');
    settingsSection.classList.toggle('hidden', activeTab !== 'settings');
  };

  toggleCollectionsBtn.addEventListener('click', () => selectTab('collections'));
  toggleProductsBtn.addEventListener('click', () => selectTab('products'));
  toggleSettingsBtn.addEventListener('click', () => selectTab('settings'));

  // Bind close buttons for modals
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  // Bind new triggers
  document.getElementById('admin-new-collection-btn').addEventListener('click', () => openCollectionModal());
  document.getElementById('admin-new-product-btn').addEventListener('click', () => openProductModal());

  // Bind filter selector
  document.getElementById('admin-product-filter-collection').addEventListener('change', populateAdminProductsTable);

  // Form submits
  document.getElementById('collection-form').addEventListener('submit', handleCollectionSubmit);
  document.getElementById('product-form').addEventListener('submit', handleProductSubmit);
  document.getElementById('brand-settings-form').addEventListener('submit', handleSettingsSubmit);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('opacity-0', 'pointer-events-none');
  modal.classList.add('opacity-100', 'pointer-events-auto');
}

function closeModal() {
  document.querySelectorAll('#collection-modal, #product-modal').forEach(modal => {
    modal.classList.remove('opacity-100', 'pointer-events-auto');
    modal.classList.add('opacity-0', 'pointer-events-none');
  });
}

// COLLECTION MODAL FUNCTIONS
window.openCollectionModal = function(id = null) {
  const titleInput = document.getElementById('collection-title-input');
  const imageInput = document.getElementById('collection-image-input');
  const showcaseInput = document.getElementById('collection-showcase-input');
  const descInput = document.getElementById('collection-desc-input');
  const editId = document.getElementById('collection-edit-id');
  const header = document.getElementById('collection-modal-title');

  if (id) {
    // EDIT MODE
    header.textContent = "Edit Collection";
    const col = collectionsState.find(c => c.id === id);
    if (!col) return;

    editId.value = col.id;
    titleInput.value = col.title;
    imageInput.value = col.image;
    showcaseInput.value = col.showcase_image || '';
    descInput.value = col.description || '';

    // Show delete button in edit mode
    const deleteBtn = document.getElementById('collection-delete-btn');
    if (deleteBtn) deleteBtn.classList.remove('hidden');
  } else {
    // CREATE MODE
    header.textContent = "Create Collection";
    editId.value = '';
    titleInput.value = '';
    imageInput.value = '';
    showcaseInput.value = '';
    descInput.value = '';

    // Hide delete button in create mode
    const deleteBtn = document.getElementById('collection-delete-btn');
    if (deleteBtn) deleteBtn.classList.add('hidden');
  }

  // Clear file inputs
  const fileInput = document.getElementById('collection-image-file');
  if (fileInput) fileInput.value = '';
  const showcaseFileInput = document.getElementById('collection-showcase-file');
  if (showcaseFileInput) showcaseFileInput.value = '';

  openModal('collection-modal');
};

// Handle delete collection from modal
window.handleCollectionDelete = async function() {
  const id = document.getElementById('collection-edit-id').value;
  const title = document.getElementById('collection-title-input').value || 'this collection';
  if (!id) return;

  const confirmed = confirm(`ต้องการลบคอลเลคชั่น "${title}" ใช่ไหมคะ?\n\nการลบจะลบสินค้าทั้งหมดในคอลเลคชั่นนี้ด้วย และไม่สามารถกู้คืนได้`);
  if (!confirmed) return;

  closeModal();
  await window.deleteCollection(id, title);
};

async function handleCollectionSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('collection-edit-id').value;
  const title = document.getElementById('collection-title-input').value.trim();
  const description = document.getElementById('collection-desc-input').value.trim();
  
  const fileInput = document.getElementById('collection-image-file');
  let image = document.getElementById('collection-image-input').value.trim();

  const showcaseFileInput = document.getElementById('collection-showcase-file');
  let showcase_image = document.getElementById('collection-showcase-input').value.trim();

  try {
    // If a thumbnail file is chosen, upload it
    if (fileInput && fileInput.files.length > 0) {
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "Uploading Image...";
      submitBtn.disabled = true;
      try {
        image = await uploadImageFile(fileInput.files[0]);
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }

    // If a showcase file is chosen, upload it
    if (showcaseFileInput && showcaseFileInput.files.length > 0) {
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "Uploading Showcase...";
      submitBtn.disabled = true;
      try {
        showcase_image = await uploadImageFile(showcaseFileInput.files[0]);
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }

    if (!image) {
      alert("Please choose an image file to upload OR paste an image URL.");
      return;
    }
    let result;
    if (id) {
      // Find old collection image to clean up
      const oldCol = collectionsState.find(c => c.id === id);
      if (oldCol && oldCol.image !== image) {
        await deleteImageFile(oldCol.image);
      }
      // Also clean up old showcase image if replaced
      if (oldCol && oldCol.showcase_image && oldCol.showcase_image !== showcase_image) {
        await deleteImageFile(oldCol.showcase_image);
      }

      // UPDATE
      result = await supabaseClient
        .from('collections')
        .update({ title, image, showcase_image: showcase_image || null, description })
        .eq('id', id);
    } else {
      // INSERT
      result = await supabaseClient
        .from('collections')
        .insert([{ title, image, showcase_image: showcase_image || null, description }]);
    }

    if (result.error) throw result.error;
    
    closeModal();
    // Fetch state again as backup, but realtime will handle live rendering
    fetchCollections();
  } catch (error) {
    alert("Error saving collection: " + error.message);
  }
}

window.deleteCollection = async function(id, title) {
  const confirmed = confirm(`ARE YOU ABSOLUTELY SURE YOU WANT TO DELETE "${title.toUpperCase()}"?\n\nDeleting this collection will permanently delete all associated products.`);
  if (!confirmed) return;

  try {
    // 1. Delete collection image file from storage
    const col = collectionsState.find(c => c.id === id);
    if (col) {
      await deleteImageFile(col.image);
    }

    // 2. Delete all related products' images from storage
    const relatedProducts = productsState.filter(p => p.collection_id === id);
    for (const prod of relatedProducts) {
      await deleteImageFile(prod.image);
    }

    // 3. Delete from database (Postgres cascade will delete records)
    const { error } = await supabaseClient
      .from('collections')
      .delete()
      .eq('id', id);

    if (error) throw error;
    fetchInitialData();
  } catch (error) {
    alert("Error deleting collection: " + error.message);
  }
};

// PRODUCT MODAL FUNCTIONS
window.openProductModal = function(id = null) {
  const collectionSelect = document.getElementById('product-collection-select');
  const categorySelect = document.getElementById('product-category-select');
  const nameInput = document.getElementById('product-name-input');
  const priceInput = document.getElementById('product-price-input');
  const imageInput = document.getElementById('product-image-input');
  const linkInput = document.getElementById('product-link-input');
  const editId = document.getElementById('product-edit-id');
  const header = document.getElementById('product-modal-title');

  if (collectionsState.length === 0) {
    alert("Please create a collection before creating a product.");
    return;
  }

  if (id) {
    // EDIT MODE
    header.textContent = "Edit Product";
    const prod = productsState.find(p => p.id === id);
    if (!prod) return;

    editId.value = prod.id;
    collectionSelect.value = prod.collection_id;
    categorySelect.value = prod.category;
    nameInput.value = prod.name;
    priceInput.value = prod.price;
    imageInput.value = prod.image;
    linkInput.value = prod.affiliate_link;

    // Show delete button in edit mode
    const deleteBtn = document.getElementById('product-delete-btn');
    if (deleteBtn) deleteBtn.classList.remove('hidden');
  } else {
    // CREATE MODE
    header.textContent = "Create Product";
    editId.value = '';
    // Select first collection as default
    collectionSelect.selectedIndex = 0;
    categorySelect.selectedIndex = 0;
    nameInput.value = '';
    priceInput.value = '';
    imageInput.value = '';
    linkInput.value = '';

    // Hide delete button in create mode
    const deleteBtn = document.getElementById('product-delete-btn');
    if (deleteBtn) deleteBtn.classList.add('hidden');
  }

  // Clear file input
  const fileInput = document.getElementById('product-image-file');
  if (fileInput) fileInput.value = '';

  openModal('product-modal');
};

// Handle delete product from modal
window.handleProductDelete = async function() {
  const id = document.getElementById('product-edit-id').value;
  const name = document.getElementById('product-name-input').value || 'this product';
  if (!id) return;

  const confirmed = confirm(`ต้องการลบสินค้า "${name}" ใช่ไหมคะ?\n\nไม่สามารถกู้คืนได้`);
  if (!confirmed) return;

  try {
    closeModal();
    const prod = productsState.find(p => p.id === id);
    if (prod) await deleteImageFile(prod.image);

    const { error } = await supabaseClient
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
    showSyncIndicator();
    fetchProducts();
  } catch (err) {
    alert('Error deleting product: ' + err.message);
  }
};

async function handleProductSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('product-edit-id').value;
  const collection_id = document.getElementById('product-collection-select').value;
  const category = document.getElementById('product-category-select').value;
  const name = document.getElementById('product-name-input').value.trim();
  const price = parseFloat(document.getElementById('product-price-input').value);
  const affiliate_link = document.getElementById('product-link-input').value.trim();

  const fileInput = document.getElementById('product-image-file');
  let image = document.getElementById('product-image-input').value.trim();

  try {
    // If a file is chosen, upload it to Supabase Storage first
    if (fileInput && fileInput.files.length > 0) {
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "Uploading Image...";
      submitBtn.disabled = true;
      try {
        image = await uploadImageFile(fileInput.files[0]);
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }

    if (!image) {
      alert("Please choose an image file to upload OR paste an image URL.");
      return;
    }
    let result;
    if (id) {
      // Find old product image to clean up
      const oldProd = productsState.find(p => p.id === id);
      if (oldProd && oldProd.image !== image) {
        await deleteImageFile(oldProd.image);
      }

      // UPDATE
      result = await supabaseClient
        .from('products')
        .update({ collection_id, category, name, price, image, affiliate_link })
        .eq('id', id);
    } else {
      // INSERT
      result = await supabaseClient
        .from('products')
        .insert([{ collection_id, category, name, price, image, affiliate_link }]);
    }

    if (result.error) throw result.error;
    
    closeModal();
    // Fetch state again as backup
    fetchProducts();
  } catch (error) {
    alert("Error saving product: " + error.message);
  }
}

window.deleteProduct = async function(id, name) {
  const confirmed = confirm(`ARE YOU ABSOLUTELY SURE YOU WANT TO DELETE "${name.toUpperCase()}"?`);
  if (!confirmed) return;

  try {
    // 1. Delete image file from storage
    const prod = productsState.find(p => p.id === id);
    if (prod) {
      await deleteImageFile(prod.image);
    }

    // 2. Delete database record
    const { error } = await supabaseClient
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
    fetchProducts();
  } catch (error) {
    alert("Error deleting product: " + error.message);
  }
};

async function handleSettingsSubmit(e) {
  e.preventDefault();
  const hero_title = document.getElementById('setting-hero-title').value.trim();
  const hero_subtitle = document.getElementById('setting-hero-subtitle').value.trim();
  const hero_image = document.getElementById('setting-hero-image').value.trim();
  const tiktok_link = document.getElementById('setting-tiktok-link').value.trim();
  const lemon8_link = document.getElementById('setting-lemon8-link').value.trim();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Saving Settings...";
  submitBtn.disabled = true;

  try {
    const updates = [
      { key: 'hero_title', value: hero_title },
      { key: 'hero_subtitle', value: hero_subtitle },
      { key: 'hero_image', value: hero_image },
      { key: 'tiktok_link', value: tiktok_link },
      { key: 'lemon8_link', value: lemon8_link }
    ];

    // Update settings in database
    for (const update of updates) {
      const { error } = await supabaseClient
        .from('settings')
        .upsert([update], { onConflict: 'key' });
      if (error) throw error;
    }

    alert("Settings saved successfully!");
    fetchSettings();
  } catch (err) {
    alert("Error saving settings: " + err.message);
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}
