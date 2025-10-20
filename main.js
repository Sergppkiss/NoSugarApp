document.addEventListener('DOMContentLoaded', () => {
  const tg = window.Telegram?.WebApp;
  if (tg) { tg.ready(); tg.expand(); }

  const ADMIN_ID = 356449850;
  const userId = tg?.initDataUnsafe?.user?.id || null;

  // Admin link gating
  const adminLink = document.getElementById('admin-link');
  const isDevAdmin = new URLSearchParams(location.search).get('admin') === '1';
  if (adminLink) {
    if (userId === ADMIN_ID || isDevAdmin) {
      adminLink.style.display = 'inline-block';
      if (isDevAdmin) adminLink.href = 'admin.html?admin=1';
    } else {
      adminLink.style.display = 'none';
    }
  }

  // Storage helpers (Telegram CloudStorage -> localStorage fallback)
  const storageKey = (base) => `${base}:${userId ?? 'anon'}`;
  const Cloud = tg?.CloudStorage;
  const inTelegram = !!(tg && tg.initDataUnsafe && tg.initDataUnsafe.user && typeof Cloud?.getItem === 'function');

  const storage = {
    get: async (key) => {
      if (inTelegram) {
        return await new Promise((resolve) => {
          let settled = false;
          const resolveLocal = () => resolve(localStorage.getItem(key));
          const timer = setTimeout(() => {
            if (!settled) { settled = true; resolveLocal(); }
          }, 600);
          Cloud.getItem(key, (_, v) => {
            if (settled) return;
            clearTimeout(timer);
            if (v !== null && v !== undefined) {
              settled = true; resolve(v);
            } else {
              settled = true; resolveLocal();
            }
          });
        });
      }
      return localStorage.getItem(key);
    },
    set: async (key, val) => {
      if (inTelegram) {
        // Всегда сохраняем в localStorage как бэкап на случай недоступности CloudStorage
        try { localStorage.setItem(key, val); } catch (_) {}
        return await new Promise((resolve) => {
          let settled = false;
          const timer = setTimeout(() => {
            if (!settled) { settled = true; resolve(); }
          }, 500);
          Cloud.setItem(key, val, () => {
            if (!settled) { settled = true; clearTimeout(timer); resolve(); }
          });
        });
      }
      localStorage.setItem(key, val);
    }
  };

  // Load recipes (prefer localStorage, else from data.js) + migrate if tags missing
  let recipes = [];
  try {
    recipes = JSON.parse(localStorage.getItem('recipes')) || window.recipes || [];
  } catch (_) { recipes = window.recipes || []; }

  const hasTags = Array.isArray(recipes) && recipes.some(r => Array.isArray(r.tags) && r.tags.length > 0);
  if (!hasTags && Array.isArray(window.recipes) && window.recipes.length) {
    // Миграция: локальные рецепты старого формата без тегов — берём актуальные из data.js
    recipes = window.recipes;
    localStorage.setItem('recipes', JSON.stringify(recipes));
  } else if (!localStorage.getItem('recipes') && recipes?.length) {
    localStorage.setItem('recipes', JSON.stringify(recipes));
  }

  // Collect all tags
  let allTags = Array.from(new Set(recipes.flatMap(r => r.tags || []))).sort((a,b)=>a.localeCompare(b));

  // State
  let selectedTags = [];
  let activeCategory = 'Все';
  let searchTerm = '';
  let savedSets = [];
  let onlyAvailable = false;

  // Elements
  const chipsBox = document.getElementById('products-chips');
  const selectAllBtn = document.getElementById('select-all-btn');
  const clearBtn = document.getElementById('clear-filter-btn');
  const saveSetBtn = document.getElementById('save-set-btn');
  const applyBtn = document.getElementById('apply-filter-btn');
  const searchInput = document.getElementById('search-bar');
  const categoryBtns = Array.from(document.querySelectorAll('#category-buttons .category-btn'));
  const recipesBox = document.getElementById('recipes');
  const savedSetsBox = document.getElementById('saved-sets-chips');
  const onlyAvailableCheckbox = document.getElementById('only-available');

  const haptic = (style='light') => tg?.HapticFeedback?.impactOccurred(style);

  // Автозагрузка рецептов из Gist
  const AUTO_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 часов
  
  function applyRecipes(newRecipes) {
    if (!Array.isArray(newRecipes) || !newRecipes.length) return;
    recipes = newRecipes;
    allTags = Array.from(new Set(recipes.flatMap(r => r.tags || []))).sort((a,b)=>a.localeCompare(b));
    selectedTags = selectedTags.filter(t => allTags.includes(t));
    renderChips();
    filterAndRender();
  }
  
  async function maybeAutoLoadGist() {
    try {
      const rawUrl = ((localStorage.getItem('gistRawUrl') || window.DEFAULT_GIST_RAW_URL || '')).trim();
      if (!rawUrl) return;
      const lastSync = Number(localStorage.getItem('lastGistSync') || 0);
      const forceSync = new URLSearchParams(location.search).get('sync') === '1';
      const noLocal = !Array.isArray(recipes) || recipes.length === 0;
      const intervalMsRaw = localStorage.getItem('autoSyncIntervalMs');
      const intervalMs = Number(intervalMsRaw) || AUTO_SYNC_INTERVAL_MS;
      const always = localStorage.getItem('autoSyncAlways') === '1';
      const stale = Date.now() - lastSync > intervalMs;
      if (!(forceSync || noLocal || always || stale)) return;
      const res = await fetch(rawUrl, { cache: 'no-store' });
      if (!res.ok) return console.warn('Auto Gist fetch failed:', res.status);
      const data = await res.json();
      if (!Array.isArray(data)) return console.warn('Gist JSON expected array');
      localStorage.setItem('recipes', JSON.stringify(data));
      localStorage.setItem('lastGistSync', String(Date.now()));
      applyRecipes(data);
      console.log('Recipes auto-loaded from Gist:', data.length);
    } catch (e) {
      console.warn('Auto-load from Gist error', e);
    }
  }

  // Restore user selection
  (async () => {
    try {
      const saved = await storage.get(storageKey('selectedTags'));
      if (saved) selectedTags = JSON.parse(saved);
      const setsRaw = await storage.get(storageKey('savedSets'));
      if (setsRaw) savedSets = JSON.parse(setsRaw);
    } catch(_) {}
    renderChips();
    renderSavedSets();
    filterAndRender();
    await maybeAutoLoadGist();
  })();

  // Render tag chips
  function renderChips() {
    if (!chipsBox) return;
    chipsBox.innerHTML = allTags.map(tag => `
      <button class="chip ${selectedTags.includes(tag)?'selected':''}" data-tag="${tag}">${capitalize(tag)}</button>
    `).join('');
    chipsBox.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        if (selectedTags.includes(tag)) {
          selectedTags = selectedTags.filter(t => t !== tag);
          btn.classList.remove('selected');
        } else {
          selectedTags.push(tag);
          btn.classList.add('selected');
        }
        haptic();
        filterAndRender();
      });
    });
  }

  // Render saved sets chips
  function renderSavedSets() {
    if (!savedSetsBox) return;
    if (!Array.isArray(savedSets)) savedSets = [];
    savedSetsBox.innerHTML = savedSets.map((s, i) => `
      <button class="chip" data-index="${i}">${s.name}</button>
    `).join('');
    savedSetsBox.querySelectorAll('.chip').forEach(btn => {
      const idx = Number(btn.dataset.index);
      btn.addEventListener('click', () => {
        const set = savedSets[idx];
        if (set) {
          selectedTags = [...set.tags];
          renderChips();
          filterAndRender();
        }
      });
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const s = savedSets[idx];
        if (s && confirm(`Удалить набор «${s.name}»?`)) {
          savedSets.splice(idx, 1);
          storage.set(storageKey('savedSets'), JSON.stringify(savedSets));
          renderSavedSets();
        }
      });
      btn.addEventListener('dblclick', () => {
        const s = savedSets[idx];
        if (s && confirm(`Удалить набор «${s.name}»?`)) {
          savedSets.splice(idx, 1);
          storage.set(storageKey('savedSets'), JSON.stringify(savedSets));
          renderSavedSets();
        }
      });
    });
  }

  // Controls
  selectAllBtn?.addEventListener('click', () => {
    haptic('medium');
    selectedTags = [...allTags];
    renderChips();
    filterAndRender();
  });

  clearBtn?.addEventListener('click', () => {
    haptic();
    selectedTags = [];
    renderChips();
    filterAndRender();
  });

  saveSetBtn?.addEventListener('click', async () => {
    haptic('medium');
    await storage.set(storageKey('selectedTags'), JSON.stringify(selectedTags));
    const now = new Date();
    const defaultName = `Набор ${now.toLocaleDateString('ru-RU')} ${now.toLocaleTimeString('ru-RU').slice(0,5)}`;
    const name = prompt('Имя набора ингредиентов:', defaultName);
    if (name && name.trim()) {
      const set = { name: name.trim(), tags: [...selectedTags] };
      const existingIdx = savedSets.findIndex(s => s.name.toLowerCase() === set.name.toLowerCase());
      if (existingIdx >= 0) savedSets[existingIdx] = set; else savedSets.push(set);
      await storage.set(storageKey('savedSets'), JSON.stringify(savedSets));
      renderSavedSets();
    }
  });

  applyBtn?.addEventListener('click', () => {
    haptic('light');
    filterAndRender();
  });

  onlyAvailableCheckbox?.addEventListener('change', () => {
    onlyAvailable = !!onlyAvailableCheckbox.checked;
    filterAndRender();
  });

  searchInput?.addEventListener('input', (e) => {
    searchTerm = (e.target.value || '').toLowerCase().trim();
    filterAndRender();
  });

  categoryBtns.forEach(b => b.addEventListener('click', () => {
    categoryBtns.forEach(btn => btn.classList.remove('active'));
    b.classList.add('active');
    activeCategory = b.dataset.category;
    haptic('light');
    filterAndRender();
  }));

  // Filtering
  function filterAndRender() {
    const term = searchTerm;
    const showAll = selectedTags.length === allTags.length || selectedTags.length === 0;

    let pool = recipes.filter(r => (
      activeCategory === 'Все' || r.category === activeCategory
    ) && r.name.toLowerCase().includes(term));

    let primary = [];
    let suggested = [];

    if (showAll) {
      primary = pool;
    } else {
      pool.forEach(r => {
        const tags = r.tags || [];
        const missing = tags.filter(t => !selectedTags.includes(t));
        if (missing.length === 0) primary.push(r);
        else if (missing.length <= 3) suggested.push({...r, _missing: missing});
      });
    }

    if (onlyAvailable) suggested = [];

    renderRecipes(primary, suggested);
  }

  // Render recipes and suggestions
  function renderRecipes(primary, suggested) {
    if (!recipesBox) return;
    recipesBox.innerHTML = '';

    const makeCard = (r) => {
      const missingLine = (r._missing && r._missing.length) ? `<p>Не хватает: ${r._missing.map(t=>capitalize(t)).join(', ')}</p>` : '';
      return `
      <div class="recipe-card" data-id="${r.id}">
        <div class="recipe-card-text">
          <h3>${r.name}</h3>
          <p>${r.category}</p>
          <p>${r.description || ''}</p>
          ${missingLine}
        </div>
        <img class="recipe-card-image" src="${r.image}" alt="${r.name}">
      </div>`;
    };

    const section = (title, list) => `
      ${list.length ? `<h3>${title}</h3>` : ''}
      ${list.map(makeCard).join('')}
    `;

    recipesBox.innerHTML = section('Подходят полностью', primary) + section('Ещё можно приготовить (не хватает 1–3 ингредиента)', suggested);

    recipesBox.querySelectorAll('.recipe-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = Number(card.dataset.id);
        const recipe = recipes.find(x => x.id === id);
        if (recipe) openModal(recipe);
      });
    });
  }

  // Modal
  const modal = document.getElementById('recipe-modal');
  const closeBtn = document.querySelector('.close-button');
  const modalImg = document.getElementById('modal-recipe-image');
  const modalName = document.getElementById('modal-recipe-name');
  const modalMeta = document.getElementById('modal-meta');
  const modalIng = document.getElementById('modal-recipe-ingredients');
  const modalTags = document.getElementById('modal-recipe-tags');
  const modalInstr = document.getElementById('modal-recipe-instructions');

  function openModal(r) {
    haptic('medium');
    modalImg.src = r.image;
    modalName.textContent = r.name;
    const calories = r.calories ? `${r.calories} ккал` : '—';
    const time = r.cookingTime || '—';
    modalMeta.textContent = `Категория: ${r.category} • Калорийность: ${calories} • Время: ${time}`;

    modalIng.innerHTML = (r.ingredients || []).map(i => `<li>${i.name}${i.quantity?` — ${i.quantity}`:''}</li>`).join('');
    modalTags.innerHTML = (r.tags || []).map(t => `<span class="chip small">${capitalize(t)}</span>`).join('');
    modalInstr.textContent = r.instructions || '';

    modal.style.display = 'block';
  }
  closeBtn?.addEventListener('click', () => { modal.style.display = 'none'; });
  window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  // Utils
  function capitalize(s){ return (s||'').charAt(0).toUpperCase()+s.slice(1); }
});