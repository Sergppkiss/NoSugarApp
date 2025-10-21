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
  const chipsBox = document.getElementById('ingredients-chips-modal');
  const selectAllBtn = document.getElementById('select-all-btn');
  const clearBtn = document.getElementById('clear-filter-btn');
  const saveSetBtn = document.getElementById('save-set-btn');
  const applyBtn = document.getElementById('apply-filter-btn');
  const searchInput = document.getElementById('search-bar');
  const categoryBtns = Array.from(document.querySelectorAll('#category-buttons .category-btn'));
  const recipesBox = document.getElementById('recipes');
  const profileBox = document.getElementById('profile-view');
  const profileFavCountEl = document.getElementById('profile-favorites-count');
  const profileClearFavBtn = document.getElementById('profile-clear-favorites-btn');
  const savedSetsBox = document.getElementById('saved-sets-chips');
  const onlyAvailableCheckbox = document.getElementById('only-available');

  // Ingredients modal elements
  const openIngredientsBtn = document.getElementById('open-ingredients-btn');
  const ingredientsModal = document.getElementById('ingredients-modal');
  const closeIngredientsModalBtn = document.getElementById('close-ingredients-modal');
  const selectAllIngredientsBtn = document.getElementById('select-all-ingredients-btn');
  const clearIngredientsBtn = document.getElementById('clear-ingredients-btn');
  const saveIngredientsBtn = document.getElementById('save-ingredients-btn');
  const ingredientsCountEl = document.getElementById('ingredients-count');

  const haptic = (style='light') => tg?.HapticFeedback?.impactOccurred(style);

  // Bottom navigation
  const bottomNav = document.getElementById('bottom-nav');
  const navHomeBtn = bottomNav?.querySelector('[data-nav="home"]');
  const navIngredientsBtn = bottomNav?.querySelector('[data-nav="ingredients"]');
  const navFavoritesBtn = bottomNav?.querySelector('[data-nav="favorites"]');
  const navProfileBtn = bottomNav?.querySelector('[data-nav="profile"]');
  const favoritesBadgeEl = bottomNav?.querySelector('#favorites-badge');

  let favorites = [];
  try { favorites = JSON.parse(localStorage.getItem('favorites') || '[]'); } catch(e) { favorites = []; }
  let showFavoritesOnly = false;

  function updateFavoritesBadge() {
    if (favoritesBadgeEl) {
      const count = favorites.length;
      if (count > 0) {
        favoritesBadgeEl.textContent = String(count);
        favoritesBadgeEl.style.display = 'inline-block';
      } else {
        favoritesBadgeEl.textContent = '';
        favoritesBadgeEl.style.display = 'none';
      }
    }
    if (profileFavCountEl) profileFavCountEl.textContent = String(favorites.length);
  }
  updateFavoritesBadge();

  function setActiveNav(key) {
    const btns = bottomNav ? Array.from(bottomNav.querySelectorAll('.bottom-nav-button')) : [];
    btns.forEach(b => b.classList.toggle('active', b.getAttribute('data-nav') === key));
  }

  function showProfileView(show) {
    if (!profileBox) return;
    profileBox.style.display = show ? 'block' : 'none';
    if (show && profileFavCountEl) profileFavCountEl.textContent = String(favorites.length);
  }

  navHomeBtn?.addEventListener('click', () => {
    haptic();
    showFavoritesOnly = false;
    setActiveNav('home');
    showProfileView(false);
    // Сбрасываем базовые фильтры
    activeCategory = 'Все';
    searchTerm = '';
    if (ingredientsModal) ingredientsModal.style.display = 'none';
    filterAndRender();
  });
  navIngredientsBtn?.addEventListener('click', () => {
    haptic('medium');
    setActiveNav('ingredients');
    showProfileView(false);
    if (ingredientsModal) ingredientsModal.style.display = 'block';
  });
  navFavoritesBtn?.addEventListener('click', () => {
    haptic('medium');
    showFavoritesOnly = true;
    setActiveNav('favorites');
    showProfileView(false);
    if (ingredientsModal) ingredientsModal.style.display = 'none';
    filterAndRender();
  });
  navProfileBtn?.addEventListener('click', () => {
    haptic('light');
    setActiveNav('profile');
    if (ingredientsModal) ingredientsModal.style.display = 'none';
    showProfileView(true);
  });

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

  // Категории ингредиентов
  const TAG_CATEGORY_MAP = {
    'яйцо': 'Яйца',
    'яйца': 'Яйца',
    'помидор': 'Овощи',
    'томат': 'Овощи',
    'шампиньон': 'Грибы',
    'грибы': 'Грибы',
    'сыр': 'Молочные продукты',
    'творог': 'Молочные продукты',
    'кокосовое молоко': 'Молочные продукты',
    'зелень': 'Зелень',
    'укроп': 'Зелень',
    'петрушка': 'Зелень',
    'курица': 'Мясо',
    'куриное филе': 'Мясо',
    'лосось': 'Рыба',
    'тунец': 'Рыба',
    'брокколи': 'Овощи',
    'чеснок': 'Овощи',
    'морковь': 'Овощи',
    'лук': 'Овощи',
    'огурец': 'Овощи',
    'спаржа': 'Овощи',
    'лимон': 'Фрукты',
    'авокадо': 'Фрукты',
    'голубика': 'Ягоды',
    'ягода': 'Ягоды',
    'миндаль': 'Орехи',
    'гречневая крупа': 'Крупы',
    'гречка': 'Крупы',
    'рис': 'Крупы',
    'овсянка': 'Крупы',
    'чиа': 'Крупы',
    'лапша': 'Макароны'
  };
  const CATEGORY_ORDER = ['Крупы','Макароны','Мясо','Рыба','Овощи','Фрукты','Молочные продукты','Яйца','Орехи','Ягоды','Зелень','Специи','Соусы','Прочее'];
  const categorySortIndex = (cat) => {
    const idx = CATEGORY_ORDER.indexOf(cat);
    return idx === -1 ? 999 : idx;
  };
  const tagCategory = (tag) => TAG_CATEGORY_MAP[(tag||'').toLowerCase()] || 'Прочее';

  // Render tag chips (grouped by category, alphabetic in each)
  function renderChips() {
    if (!chipsBox) return;
    const groups = {};
    allTags.forEach(tag => {
      const cat = tagCategory(tag);
      groups[cat] = groups[cat] || [];
      groups[cat].push(tag);
    });

    const sortedCats = Object.keys(groups).sort((a,b) => {
      const byOrder = categorySortIndex(a) - categorySortIndex(b);
      return byOrder !== 0 ? byOrder : a.localeCompare(b, 'ru');
    });

    const html = sortedCats.map(cat => {
      const tags = groups[cat].sort((a,b) => a.localeCompare(b, 'ru'));
      const chips = tags.map(tag => `<button class="chip ${selectedTags.includes(tag)?'selected':''}" data-tag="${tag}">${capitalize(tag)}</button>`).join('');
      return `<div class="ingredients-category"><h4 class="ingredients-category-title">${cat}</h4><div class="chips-container">${chips}</div></div>`;
    }).join('');

    chipsBox.innerHTML = html;

    // Обновляем счётчик выбранных ингредиентов
    if (ingredientsCountEl) ingredientsCountEl.textContent = String(selectedTags.length);

    chipsBox.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-tag');
        if (selectedTags.includes(tag)) {
          selectedTags = selectedTags.filter(t => t !== tag);
          btn.classList.remove('selected');
        } else {
          selectedTags.push(tag);
          btn.classList.add('selected');
        }
        haptic();
        filterAndRender();
        if (ingredientsCountEl) ingredientsCountEl.textContent = String(selectedTags.length);
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
  // Modal open/close
  // Кнопка открытия модалки ингредиентов сверху удалена; используем нижнее меню.
  closeIngredientsModalBtn?.addEventListener('click', () => {
    if (ingredientsModal) ingredientsModal.style.display = 'none';
  });
  window.addEventListener('click', (e) => {
    if (e.target === ingredientsModal) ingredientsModal.style.display = 'none';
  });

  // Selection controls inside modal
  selectAllIngredientsBtn?.addEventListener('click', () => {
    haptic('medium');
    selectedTags = [...allTags];
    renderChips();
    filterAndRender();
    if (ingredientsCountEl) ingredientsCountEl.textContent = String(selectedTags.length);
  });

  clearIngredientsBtn?.addEventListener('click', () => {
    haptic();
    selectedTags = [];
    renderChips();
    filterAndRender();
    if (ingredientsCountEl) ingredientsCountEl.textContent = String(selectedTags.length);
  });

  saveIngredientsBtn?.addEventListener('click', async () => {
    haptic('medium');
    await storage.set(storageKey('selectedTags'), JSON.stringify(selectedTags));
    if (ingredientsModal) ingredientsModal.style.display = 'none';
    filterAndRender();
    if (ingredientsCountEl) ingredientsCountEl.textContent = String(selectedTags.length);
  });
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

  // Removed multi-set saving; selection is saved via modal's "Сохранить"
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

  // Профиль: очистка избранного
  profileClearFavBtn?.addEventListener('click', () => {
    haptic('medium');
    favorites = [];
    try { localStorage.setItem('favorites', JSON.stringify(favorites)); } catch(e) {}
    updateFavoritesBadge();
    showFavoritesOnly = false;
    setActiveNav('home');
    showProfileView(true);
    filterAndRender();
  });

  // Disable any image zoom or double-click actions on recipe images
  document.addEventListener('dblclick', (e) => {
    const t = e.target;
    if (
      t.closest('.recipe-card') ||
      t.matches('.recipe-card-image') ||
      t.matches('#modal-recipe-image')
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  // Filtering
  function filterAndRender() {
    const term = searchTerm;
    const showAll = selectedTags.length === allTags.length || selectedTags.length === 0;

    let pool = recipes.filter(r => (
      (activeCategory === 'Все' || r.category === activeCategory) &&
      r.name.toLowerCase().includes(term)
    ));

    let primary = [];
  let suggested = [];

  if (showFavoritesOnly) {
    // Показываем только избранные рецепты
    primary = pool.filter(r => favorites.includes(r.id));
    suggested = [];
  } else if (showAll) {
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
      const missingLine = (r._missing && r._missing.length) ? `<p class="recipe-card-missing">Не хватает: ${r._missing.map(t=>capitalize(t)).join(', ')}</p>` : '';
      const isFav = favorites.includes(r.id);
      return `
      <div class="recipe-card" data-id="${r.id}">
        <button class="favorite-toggle ${isFav ? 'active' : ''}" data-id="${r.id}" aria-label="Добавить в избранное">
          <span class="fav-icon">${isFav ? '⭐' : '☆'}</span>
        </button>
        <img class="recipe-card-image" src="${r.image}" alt="${r.name}">
        <div class="recipe-card-text">
          <h3>${r.name}</h3>
          <p class="recipe-card-category">${r.category}</p>
          ${missingLine}
        </div>
      </div>`;
    };

    const section = (title, list) => {
      if (!list.length) return '';
      return `
        <section class="recipes-section">
          <h3 class="recipes-section-title">${title}</h3>
          <div class="recipes-grid">
            ${list.map(makeCard).join('')}
          </div>
        </section>
      `;
    };

    recipesBox.innerHTML = section('Подходят полностью', primary) + section('Ещё можно приготовить (не хватает 1–3 ингредиента)', suggested);

    // Если открыт профиль, скрываем список рецептов
    if (profileBox && profileBox.style.display === 'block') {
      recipesBox.innerHTML = '';
      return;
    }

    recipesBox.querySelectorAll('.recipe-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = Number(card.dataset.id);
        const recipe = recipes.find(x => x.id === id);
        if (recipe) openModal(recipe);
      });
    });

    // Обработчик кнопки избранного на карточке
    recipesBox.querySelectorAll('.favorite-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(btn.getAttribute('data-id'));
        const isFav = favorites.includes(id);
        if (isFav) {
          favorites = favorites.filter(x => x !== id);
        } else {
          favorites.push(id);
        }
        try { localStorage.setItem('favorites', JSON.stringify(favorites)); } catch(e) {}
         btn.classList.toggle('active', !isFav);
         const icon = btn.querySelector('.fav-icon');
         if (icon) icon.textContent = !isFav ? '⭐' : '☆';
         updateFavoritesBadge();
         // Если открыт режим "Избранное", обновляем список
         if (showFavoritesOnly) filterAndRender();
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
    
    // Красивое отображение метаинформации с иконками
    const calories = r.calories ? `${r.calories} ккал` : '—';
    const time = r.cookingTime ? (r.cookingTime >= 60 ? `${Math.floor(r.cookingTime / 60)}ч ${r.cookingTime % 60}мин` : `${r.cookingTime} мин`) : '—';
    
    modalMeta.innerHTML = `
      <div class="meta-info">
        <div class="meta-item">
          <span class="icon">🔥</span>
          <span>${calories}</span>
        </div>
        <div class="meta-item">
          <span class="icon">⏱️</span>
          <span>${time}</span>
        </div>
        <div class="meta-category">${r.category}</div>
      </div>
    `;

    // Обработка ингредиентов - поддержка как старого формата (объекты), так и нового (строки)
    const ingredients = r.ingredients || [];
    if (Array.isArray(ingredients)) {
      if (ingredients.length > 0 && typeof ingredients[0] === 'object') {
        // Старый формат: массив объектов с name и quantity
        modalIng.innerHTML = ingredients.map(i => `<li>${i.name}${i.quantity ? ` — ${i.quantity}` : ''}</li>`).join('');
      } else {
        // Новый формат: массив строк
        modalIng.innerHTML = ingredients.map(i => `<li>${i}</li>`).join('');
      }
    } else {
      modalIng.innerHTML = '';
    }

    modalTags.innerHTML = (r.tags || []).map(t => `<span class="chip small">${capitalize(t)}</span>`).join('');
    modalInstr.textContent = r.instructions || '';

    modal.style.display = 'block';
  }
  closeBtn?.addEventListener('click', () => { modal.style.display = 'none'; });
  window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  // Utils
  function capitalize(s){ return (s||'').charAt(0).toUpperCase()+s.slice(1); }
});