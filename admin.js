document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram?.WebApp;
    if (tg) { tg.ready(); tg.expand(); }
    const ADMIN_ID = 356449850;
    const userId = tg?.initDataUnsafe?.user?.id || null;
    const isDevAdmin = new URLSearchParams(location.search).get('admin') === '1';
    const inTelegram = !!(tg && tg.initDataUnsafe && tg.initDataUnsafe.user);

    if (!(isDevAdmin || (inTelegram && userId === ADMIN_ID))) {
        document.body.innerHTML = '<div class="container"><h1>Доступ запрещён</h1><p>Админ-панель доступна только администратору.</p><p>Для локального доступа откройте <code>admin.html?admin=1</code>.</p></div>';
        return;
    }

    // Элементы формы
    const form = document.getElementById('recipe-form');
    const formTitle = document.getElementById('form-title');
    const recipeIdInput = document.getElementById('recipe-id');
    const recipeNameInput = document.getElementById('recipe-name');
    const recipeCategoryInput = document.getElementById('recipe-category');
    const recipeDescriptionInput = document.getElementById('recipe-description');
    const recipeTagsInput = document.getElementById('recipe-tags');
    const tagInput = document.getElementById('tag-input');
    const addTagBtn = document.getElementById('add-tag-btn');
    const tagsListEl = document.getElementById('tags-list');
    const recipeImageInput = document.getElementById('recipe-image');
    const saveBtn = document.getElementById('save-btn');
    const clearBtn = document.getElementById('clear-btn');

    // Настройки (иконка/модалка)
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsModalBtn = document.getElementById('close-settings-modal');

    // Gist конфиг элементы
    const gistRawInput = document.getElementById('gist-raw-url');
    const tokenInput = document.getElementById('github-token');
    const gistLoadBtn = document.getElementById('gist-load-btn');
    const gistSaveBtn = document.getElementById('gist-save-btn');
    const autoSyncAlwaysInput = document.getElementById('gist-auto-sync-always');
    const autoSyncIntervalInput = document.getElementById('gist-auto-sync-interval');
    const cloudNameInput = document.getElementById('cloudinary-cloud');
    const cloudPresetInput = document.getElementById('cloudinary-preset');
    const cloudFolderInput = document.getElementById('cloudinary-folder');
    const imageFileInput = document.getElementById('recipe-image-file');
    const uploadImageBtn = document.getElementById('upload-image-btn');

    // Контейнер для списка рецептов
    const adminRecipesList = document.getElementById('admin-recipes-list');

    // Открытие/закрытие модалки настроек
    openSettingsBtn?.addEventListener('click', () => {
        if (settingsModal) settingsModal.style.display = 'block';
    });
    closeSettingsModalBtn?.addEventListener('click', () => {
        if (settingsModal) settingsModal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.style.display = 'none';
    });

    // Хранилище конфига (CloudStorage -> localStorage)
    const Cloud = tg?.CloudStorage;
    const hasCloud = !!(tg && tg.initDataUnsafe && tg.initDataUnsafe.user && typeof Cloud?.getItem === 'function');
    const configStore = {
        get: async (key) => {
            if (hasCloud) {
                return await new Promise((resolve) => {
                    let settled = false;
                    const timer = setTimeout(() => { if (!settled) { settled = true; resolve(localStorage.getItem(key)); } }, 600);
                    Cloud.getItem(key, (_, v) => { if (!settled) { clearTimeout(timer); settled = true; resolve(v ?? localStorage.getItem(key)); } });
                });
            }
            return localStorage.getItem(key);
        },
        set: async (key, val) => {
            try { localStorage.setItem(key, val); } catch(_) {}
            if (hasCloud) {
                return await new Promise((resolve) => {
                    let settled = false;
                    const timer = setTimeout(() => { if (!settled) { settled = true; resolve(); } }, 500);
                    Cloud.setItem(key, val, () => { if (!settled) { clearTimeout(timer); settled = true; resolve(); } });
                });
            }
        }
    };

    // Автозагрузка рецептов из Gist
    const AUTO_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 часов

    async function maybeAutoLoadGist() {
        try {
            const rawUrl = (gistRawInput?.value || await configStore.get('gistRawUrl') || window.DEFAULT_GIST_RAW_URL || '').trim();
            if (!rawUrl) return;
            const lastSyncRaw = await configStore.get('lastGistSync');
            const lastSync = Number(lastSyncRaw || 0);
            const forceSync = new URLSearchParams(location.search).get('sync') === '1';
            const noLocal = !Array.isArray(recipes) || recipes.length === 0;
            const intervalMsRaw = await configStore.get('autoSyncIntervalMs');
            const intervalMs = Number(intervalMsRaw) || AUTO_SYNC_INTERVAL_MS;
            const alwaysRaw = await configStore.get('autoSyncAlways');
            const always = alwaysRaw === '1';
            const stale = Date.now() - lastSync > intervalMs;
            if (!(forceSync || noLocal || always || stale)) return;
            const res = await fetch(rawUrl, { cache: 'no-store' });
            if (!res.ok) return console.warn('Auto Gist fetch failed:', res.status);
            const data = await res.json();
            if (Array.isArray(data)) {
                recipes = data;
            } else if (data && Array.isArray(data.recipes)) {
                recipes = data.recipes;
                const tcs = data.tagCategoryState;
                if (tcs && tcs.tagCategoryMapping && tcs.categoryList) {
                    try {
                        localStorage.setItem('tagCategoryMapping', JSON.stringify(tcs.tagCategoryMapping));
                        localStorage.setItem('tagCategoryList', JSON.stringify(tcs.categoryList));
                        if (Array.isArray(tcs.extraTagsList)) localStorage.setItem('extraTagsList', JSON.stringify(tcs.extraTagsList));
                    } catch(_) {}
                }
            } else {
                return console.warn('Gist JSON expected array or {recipes} object');
            }
            saveRecipes();
            await configStore.set('lastGistSync', String(Date.now()));
            console.log('Admin: recipes auto-loaded from Gist', Array.isArray(recipes) ? recipes.length : 0);
        } catch (e) {
            console.warn('Admin auto-load from Gist error', e);
        }
    }
    // Инициализация конфига
    (async () => {
        try {
            const raw = await configStore.get('gistRawUrl');
            const tok = await configStore.get('githubToken');
            if (gistRawInput) {
                if (raw) gistRawInput.value = raw;
                else if (window.DEFAULT_GIST_RAW_URL) gistRawInput.value = window.DEFAULT_GIST_RAW_URL;
            }
            if (tokenInput && tok) tokenInput.value = tok;
            const alwaysRaw = await configStore.get('autoSyncAlways');
            const intervalMsRaw = await configStore.get('autoSyncIntervalMs');
            if (autoSyncAlwaysInput) autoSyncAlwaysInput.checked = (alwaysRaw === '1');
            if (autoSyncIntervalInput) {
                autoSyncIntervalInput.value = intervalMsRaw ? String(Math.round(Number(intervalMsRaw) / (60*60*1000))) : '6';
            }
            const cloud = await configStore.get('cloudinaryCloud');
            const preset = await configStore.get('cloudinaryPreset');
            const folder = await configStore.get('cloudinaryFolder');
            if (cloudNameInput && cloud) cloudNameInput.value = cloud;
            if (cloudPresetInput && preset) cloudPresetInput.value = preset;
            if (cloudFolderInput && folder) cloudFolderInput.value = folder;
        } catch(_) {}
    })();

    gistRawInput?.addEventListener('change', () => { configStore.set('gistRawUrl', gistRawInput.value.trim()); });
    tokenInput?.addEventListener('change', () => { configStore.set('githubToken', tokenInput.value.trim()); });
    autoSyncAlwaysInput?.addEventListener('change', () => { configStore.set('autoSyncAlways', autoSyncAlwaysInput.checked ? '1' : '0'); });
    autoSyncIntervalInput?.addEventListener('change', () => {
        const hours = parseFloat(autoSyncIntervalInput.value);
        const ms = Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60 * 60 * 1000) : AUTO_SYNC_INTERVAL_MS;
        configStore.set('autoSyncIntervalMs', String(ms));
    });
    cloudNameInput?.addEventListener('change', () => { configStore.set('cloudinaryCloud', cloudNameInput.value.trim()); });
    cloudPresetInput?.addEventListener('change', () => { configStore.set('cloudinaryPreset', cloudPresetInput.value.trim()); });
    cloudFolderInput?.addEventListener('change', () => { configStore.set('cloudinaryFolder', cloudFolderInput.value.trim()); });

    // Загружаем рецепты
    let recipes = JSON.parse(localStorage.getItem('recipes'));
    if (!recipes || recipes.length === 0) {
        localStorage.setItem('recipes', JSON.stringify(window.recipes));
        recipes = window.recipes;
    }

    function saveRecipes() {
        localStorage.setItem('recipes', JSON.stringify(recipes));
    }

    function displayAdminRecipes() {
        const listEl = adminRecipesList;
        listEl.innerHTML = '';
        (recipes || []).forEach((r, idx) => {
            const item = document.createElement('div');
            item.className = 'recipe-item-admin';
            item.innerHTML = `
                <span>${idx+1}. ${r.name}</span>
                <div class="actions">
                    <button class="edit-btn">Редактировать</button>
                    <button class="delete-btn">Удалить</button>
                </div>
            `;
            item.querySelector('.edit-btn').addEventListener('click', () => {
                fillFormForEdit(r, idx);
            });
            item.querySelector('.delete-btn').addEventListener('click', () => {
                if (confirm('Удалить рецепт?')) {
                    recipes.splice(idx, 1);
                    saveRecipes();
                    displayAdminRecipes();
                }
            });
            listEl.appendChild(item);
        });
    }

    let tagsState = [];
    function renderTags() {
        if (!tagsListEl) return;
        tagsListEl.innerHTML = '';
        tagsState.forEach((tag, i) => {
            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.textContent = tag;
            const editBtn = document.createElement('button');
            editBtn.className = 'button';
            editBtn.style.marginLeft = '6px';
            editBtn.textContent = '✎';
            editBtn.title = 'Редактировать тег';
            editBtn.addEventListener('click', () => {
                const next = prompt('Изменить тег', tag);
                const v = (next || '').trim();
                if (!v) return;
                if (tagsState.some((t, idx) => idx !== i && t.toLowerCase() === v.toLowerCase())) return alert('Такой тег уже есть');
                tagsState[i] = v;
                recipeTagsInput.value = tagsState.join(', ');
                renderTags();
            });
            const delBtn = document.createElement('button');
            delBtn.className = 'button';
            delBtn.style.marginLeft = '6px';
            delBtn.textContent = '✕';
            delBtn.title = 'Удалить тег';
            delBtn.addEventListener('click', () => {
                tagsState.splice(i, 1);
                recipeTagsInput.value = tagsState.join(', ');
                renderTags();
            });
            const wrap = document.createElement('div');
            wrap.style.display = 'inline-flex';
            wrap.style.alignItems = 'center';
            wrap.style.gap = '4px';
            wrap.appendChild(chip);
            wrap.appendChild(editBtn);
            wrap.appendChild(delBtn);
            tagsListEl.appendChild(wrap);
        });
    }

    addTagBtn?.addEventListener('click', () => {
        const v = (tagInput?.value || '').trim();
        if (!v) return;
        if (tagsState.some(t => t.toLowerCase() === v.toLowerCase())) return alert('Такой тег уже добавлен');
        tagsState.push(v);
        recipeTagsInput.value = tagsState.join(', ');
        tagInput.value = '';
        renderTags();
    });

    function clearForm() {
        recipeIdInput.value = '';
        recipeNameInput.value = '';
        recipeCategoryInput.value = 'Завтрак';
        recipeDescriptionInput.value = '';
        recipeTagsInput.value = '';
        tagsState = [];
        renderTags();
        recipeImageInput.value = '';
        document.getElementById('recipe-calories') && (document.getElementById('recipe-calories').value = '');
        document.getElementById('recipe-cooking-time') && (document.getElementById('recipe-cooking-time').value = '');
        document.getElementById('recipe-ingredients') && (document.getElementById('recipe-ingredients').value = '');
        document.getElementById('recipe-instructions') && (document.getElementById('recipe-instructions').value = '');
        formTitle.textContent = 'Добавить новый рецепт';
    }

    function fillFormForEdit(r, idx) {
        recipeIdInput.value = String(idx);
        recipeNameInput.value = r.name || '';
        recipeCategoryInput.value = r.category || 'Завтрак';
        recipeDescriptionInput.value = r.description || '';
        tagsState = Array.isArray(r.tags) ? [...r.tags] : ((r.tags || '').split(',').map(t=>t.trim()).filter(Boolean));
        recipeTagsInput.value = tagsState.join(', ');
        renderTags();
        recipeImageInput.value = r.image || '';

        // Новые поля
        const caloriesEl = document.getElementById('recipe-calories');
        const cookingTimeEl = document.getElementById('recipe-cooking-time');
        const ingredientsEl = document.getElementById('recipe-ingredients');
        const instructionsEl = document.getElementById('recipe-instructions');
        if (caloriesEl) caloriesEl.value = r.calories || '';
        if (cookingTimeEl) cookingTimeEl.value = r.cookingTime || '';
        if (ingredientsEl) {
            const ing = Array.isArray(r.ingredients) ? r.ingredients.join('\n') : (r.ingredients || '');
            ingredientsEl.value = ing;
        }
        if (instructionsEl) instructionsEl.value = r.instructions || '';

        formTitle.textContent = 'Редактировать рецепт';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = recipeNameInput.value.trim();
        const category = recipeCategoryInput.value;
        const description = recipeDescriptionInput.value.trim();
        const tags = tagsState.length ? tagsState : recipeTagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
        const image = recipeImageInput.value.trim();
        if (!name || !category || tags.length === 0 || !image) {
            alert('Заполните обязательные поля: название, категория, теги, изображение');
            return;
        }
        const idxRaw = recipeIdInput.value.trim();
        if (idxRaw) {
            const idx = Number(idxRaw);
            if (Number.isFinite(idx) && idx >= 0 && idx < recipes.length) {
                recipes[idx] = {
                    ...recipes[idx],
                    name,
                    category,
                    calories: (document.getElementById('recipe-calories')?.value || '').trim(),
                    cookingTime: (document.getElementById('recipe-cooking-time')?.value || '').trim(),
                    description,
                    tags,
                    ingredients: (document.getElementById('recipe-ingredients')?.value || '')
                        .split('\n')
                        .map(t => t.trim())
                        .filter(Boolean),
                    instructions: (document.getElementById('recipe-instructions')?.value || '').trim(),
                    image
                };
            }
        } else {
            recipes.push({
                name,
                category,
                calories: (document.getElementById('recipe-calories')?.value || '').trim(),
                cookingTime: (document.getElementById('recipe-cooking-time')?.value || '').trim(),
                description,
                tags,
                ingredients: (document.getElementById('recipe-ingredients')?.value || '')
                    .split('\n')
                    .map(t => t.trim())
                    .filter(Boolean),
                instructions: (document.getElementById('recipe-instructions')?.value || '').trim(),
                image
            });
        }
        saveRecipes();
        displayAdminRecipes();
        clearForm();
        alert('Сохранено');
    });

    // Gist helpers
    function parseGistInfo(rawUrl) {
        try {
            const u = new URL(rawUrl);
            const parts = u.pathname.split('/').filter(Boolean);
            const gistId = parts[1]; // /username/<gistId>/raw/.../filename
            const filename = parts[parts.length - 1];
            if (!gistId || !filename) return null;
            return { gistId, filename };
        } catch(_) { return null; }
    }

    gistLoadBtn?.addEventListener('click', async () => {
        const rawUrl = (gistRawInput?.value || '').trim();
        if (!rawUrl) return alert('Укажите Gist RAW URL');
        try {
            gistLoadBtn.disabled = true;
            const res = await fetch(rawUrl, { cache: 'no-store' });
            if (!res.ok) throw new Error('Ошибка загрузки Gist: ' + res.status);
            const data = await res.json();
            // Поддержка двух форматов: массив рецептов или объект { recipes, tagCategoryState }
            if (Array.isArray(data)) {
                recipes = data;
            } else if (data && Array.isArray(data.recipes)) {
                recipes = data.recipes;
                const tcs = data.tagCategoryState;
                if (tcs && tcs.tagCategoryMapping && tcs.categoryList) {
                    try {
                        localStorage.setItem('tagCategoryMapping', JSON.stringify(tcs.tagCategoryMapping));
                        localStorage.setItem('tagCategoryList', JSON.stringify(tcs.categoryList));
                        if (Array.isArray(tcs.extraTagsList)) localStorage.setItem('extraTagsList', JSON.stringify(tcs.extraTagsList));
                    } catch(_) {}
                    loadTagCategoryState();
                }
            } else {
                throw new Error('Ожидается JSON-массив рецептов или объект с recipes');
            }
            saveRecipes();
            displayAdminRecipes();
            // Если открыт вид тегов, обновим UI
            renderTagCategoriesUI();
            alert('Данные загружены из Gist');
        } catch (e) {
            alert(e.message);
        } finally {
            gistLoadBtn.disabled = false;
        }
    });

    gistSaveBtn?.addEventListener('click', async () => {
        const rawUrl = (gistRawInput?.value || '').trim();
        const token = (tokenInput?.value || '').trim();
        if (!rawUrl) return alert('Укажите Gist RAW URL');
        if (!token) return alert('Укажите GitHub Token с правами gist');
        const info = parseGistInfo(rawUrl);
        if (!info) return alert('Не удалось распарсить Gist из RAW URL');
        const { gistId, filename } = info;
        try {
            gistSaveBtn.disabled = true;
            // Готовим расширенный payload с рецептами и состоянием тегов/категорий
            loadTagCategoryState();
            const payload = {
                recipes,
                tagCategoryState: {
                    tagCategoryMapping,
                    categoryList,
                    extraTagsList
                }
            };
            const body = {
                files: {
                    [filename]: { content: JSON.stringify(payload, null, 2) }
                }
            };
            const res = await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Не удалось сохранить в Gist: ${res.status} ${text}`);
            }
            const json = await res.json();
            const updatedRaw = json?.files?.[filename]?.raw_url;
            if (updatedRaw) {
                await configStore.set('gistRawUrl', updatedRaw);
                if (gistRawInput) gistRawInput.value = updatedRaw;
            }
            alert('Данные (рецепты и теги) сохранены в Gist');
        } catch (e) {
            alert(e.message);
        } finally {
            gistSaveBtn.disabled = false;
        }
    });

    // Навигация нижней панели
    const settingsView = document.getElementById('settings-view');
    const newRecipeView = document.getElementById('new-recipe-view');
    const tagsMgmtView = document.getElementById('tags-management-view');
    const recipesView = document.getElementById('recipes-view');

    const navSettings = document.getElementById('adminNavSettings');
    const navNew = document.getElementById('adminNavNewRecipe');
    const navTags = document.getElementById('adminNavTags');
    const navRecipes = document.getElementById('adminNavRecipes');

    function setAdminView(view) {
      [settingsView, newRecipeView, tagsMgmtView, recipesView].forEach(v => v && (v.style.display = 'none'));
      [navSettings, navNew, navTags, navRecipes].forEach(b => b && b.classList.remove('active'));
      switch(view) {
        case 'settings':
          if (settingsView) settingsView.style.display = 'block';
          if (navSettings) navSettings.classList.add('active');
          break;
        case 'tags':
          if (tagsMgmtView) tagsMgmtView.style.display = 'block';
          if (navTags) navTags.classList.add('active');
          break;
        case 'recipes':
          if (recipesView) recipesView.style.display = 'block';
          if (navRecipes) navRecipes.classList.add('active');
          break;
        default:
          if (newRecipeView) newRecipeView.style.display = 'block';
          if (navNew) navNew.classList.add('active');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    navSettings?.addEventListener('click', () => setAdminView('settings'));
    navNew?.addEventListener('click', () => setAdminView('new'));
    navTags?.addEventListener('click', () => { setAdminView('tags'); renderTagCategoriesUI(); });
    navRecipes?.addEventListener('click', () => { setAdminView('recipes'); });

    // Открыть настройки Gist со страницы «Настройки»
    document.getElementById('open-gist-settings-from-settings')?.addEventListener('click', () => {
      if (settingsModal) settingsModal.style.display = 'block';
    });

    // Менеджер тегов и категорий
    const DEFAULT_CATEGORY = 'Без категории';
    // Базовые категории по умолчанию (добавляются, если их нет в состоянии)
    const BASE_CATEGORIES = [
      'Крупы',
      'Мясо',
      'Рыба',
      'Овощи',
      'Фрукты',
      'Ягоды',
      'Грибы',
      'Молочные продукты',
      'Зелень',
      'Бобовые',
      'Орехи и семена',
      'Специи и соусы',
      'Напитки'
    ];
    let tagCategoryMapping = {};
    let categoryList = [];
    let extraTagsList = [];

    function loadTagCategoryState() {
      try {
        tagCategoryMapping = JSON.parse(localStorage.getItem('tagCategoryMapping') || '{}');
      } catch(_) { tagCategoryMapping = {}; }
      try {
        categoryList = JSON.parse(localStorage.getItem('tagCategoryList') || '[]');
      } catch(_) { categoryList = []; }
      try {
        extraTagsList = JSON.parse(localStorage.getItem('extraTagsList') || '[]');
      } catch(_) { extraTagsList = []; }
      // Гарантируем наличие дефолтной и базовых категорий
      const merged = new Set([DEFAULT_CATEGORY, ...categoryList, ...BASE_CATEGORIES]);
      categoryList = Array.from(merged);
      // Перемещаем DEFAULT_CATEGORY в начало
      categoryList = [DEFAULT_CATEGORY, ...categoryList.filter(c => c !== DEFAULT_CATEGORY)];
    }
    function saveTagCategoryState() {
      localStorage.setItem('tagCategoryMapping', JSON.stringify(tagCategoryMapping));
      localStorage.setItem('tagCategoryList', JSON.stringify(categoryList));
      localStorage.setItem('extraTagsList', JSON.stringify(extraTagsList));
    }
    function collectAllTags() {
      const s = new Set();
      (recipes || []).forEach(r => {
        const tags = Array.isArray(r.tags) ? r.tags : ((r.tags || '').split(',').map(t=>t.trim()).filter(Boolean));
        tags.forEach(t => s.add(t));
      });
      extraTagsList.forEach(t => s.add(t));
      const arr = Array.from(s);
      arr.sort((a,b)=>a.localeCompare(b, 'ru'));
      return arr;
    }
    function renderCategoriesList() {
      const el = document.getElementById('categories-list');
      if (!el) return;
      el.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.flexWrap = 'wrap';
      wrap.style.gap = '8px';
      categoryList.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'button';
        btn.textContent = cat;
        btn.addEventListener('click', () => {
          const next = prompt('Переименовать категорию', cat);
          const v = (next||'').trim();
          if (!v || v === cat) return;
          const idx = categoryList.indexOf(cat);
          if (idx >= 0) categoryList[idx] = v;
          // переназначаем теги
          Object.keys(tagCategoryMapping).forEach(tag => {
            if (tagCategoryMapping[tag] === cat) tagCategoryMapping[tag] = v;
          });
          saveTagCategoryState();
          renderTagCategoriesUI();
        });
        const del = document.createElement('button');
        del.className = 'button';
        del.textContent = 'Удалить';
        del.addEventListener('click', () => {
          if (cat === DEFAULT_CATEGORY) return alert('Эту категорию удалить нельзя');
          if (!confirm('Удалить категорию? Теги будут перемещены в «Без категории».')) return;
          categoryList = categoryList.filter(c => c !== cat);
          Object.keys(tagCategoryMapping).forEach(tag => {
            if (tagCategoryMapping[tag] === cat) tagCategoryMapping[tag] = DEFAULT_CATEGORY;
          });
          saveTagCategoryState();
          renderTagCategoriesUI();
        });
        const item = document.createElement('div');
        item.style.display = 'inline-flex';
        item.style.gap = '6px';
        item.appendChild(btn);
        item.appendChild(del);
        wrap.appendChild(item);
      });
      el.appendChild(wrap);
    }
    function renderTagsTable() {
      const el = document.getElementById('tags-table');
      if (!el) return;
      el.innerHTML = '';
      const tags = collectAllTags();
      const table = document.createElement('div');
      tags.forEach(tag => {
        if (!tagCategoryMapping[tag]) tagCategoryMapping[tag] = DEFAULT_CATEGORY;
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '8px';
        row.style.marginBottom = '6px';
        const name = document.createElement('span');
        name.textContent = tag;
        name.className = 'chip';
        const catSel = document.createElement('select');
        categoryList.forEach(cat => {
          const opt = document.createElement('option');
          opt.value = cat;
          opt.textContent = cat;
          if (tagCategoryMapping[tag] === cat) opt.selected = true;
          catSel.appendChild(opt);
        });
        catSel.addEventListener('change', () => {
          tagCategoryMapping[tag] = catSel.value;
          saveTagCategoryState();
        });
        const renameBtn = document.createElement('button');
        renameBtn.className = 'button';
        renameBtn.textContent = 'Переименовать';
        renameBtn.addEventListener('click', () => {
          const next = prompt('Новое имя тега', tag);
          const v = (next||'').trim();
          if (!v || v === tag) return;
          // Обновляем теги во всех рецептах
          (recipes || []).forEach(r => {
            let t = Array.isArray(r.tags) ? r.tags : ((r.tags || '').split(',').map(x=>x.trim()).filter(Boolean));
            t = t.map(x => x === tag ? v : x);
            r.tags = t;
          });
          saveRecipes();
          displayAdminRecipes();
          // переносим категорию
          const cat = tagCategoryMapping[tag] || DEFAULT_CATEGORY;
          delete tagCategoryMapping[tag];
          tagCategoryMapping[v] = cat;
          // переименуем в extraTagsList при необходимости
          if (extraTagsList.includes(tag)) {
            extraTagsList = extraTagsList.map(x => x === tag ? v : x);
          }
          saveTagCategoryState();
          renderTagCategoriesUI();
          alert('Тег переименован во всех рецептах');
        });
        row.appendChild(name);
        row.appendChild(catSel);
        row.appendChild(renameBtn);
        // удалить только пользовательские теги
        if (extraTagsList.includes(tag)) {
          const delBtn = document.createElement('button');
          delBtn.className = 'button danger';
          delBtn.textContent = 'Удалить';
          delBtn.addEventListener('click', () => {
            extraTagsList = extraTagsList.filter(t => t !== tag);
            delete tagCategoryMapping[tag];
            saveTagCategoryState();
            renderTagCategoriesUI();
          });
          row.appendChild(delBtn);
        }
        el.appendChild(row);
      });
      // блок добавления нового тега
      const addBtn = document.getElementById('add-tag-btn-global');
      const input = document.getElementById('new-tag-input-global');
      const catSelect = document.getElementById('new-tag-category');
      if (catSelect) {
        catSelect.innerHTML = '';
        categoryList.forEach(cat => {
          const opt = document.createElement('option');
          opt.value = cat;
          opt.textContent = cat;
          catSelect.appendChild(opt);
        });
      }
      if (addBtn && input && catSelect) {
        addBtn.onclick = () => {
          const raw = (input.value || '').trim();
          if (!raw) return alert('Введите название тега');
          const all = collectAllTags().map(x => x.toLowerCase());
          if (all.includes(raw.toLowerCase())) return alert('Такой тег уже существует');
          extraTagsList.push(raw);
          tagCategoryMapping[raw] = catSelect.value || DEFAULT_CATEGORY;
          saveTagCategoryState();
          input.value = '';
          renderTagCategoriesUI();
        };
      }
    }
    gistSaveBtn?.addEventListener('click', async () => {
        const rawUrl = (gistRawInput?.value || '').trim();
        const token = (tokenInput?.value || '').trim();
        if (!rawUrl) return alert('Укажите Gist RAW URL');
        if (!token) return alert('Укажите GitHub Token с правами gist');
        const info = parseGistInfo(rawUrl);
        if (!info) return alert('Не удалось распарсить Gist из RAW URL');
        const { gistId, filename } = info;
        try {
            gistSaveBtn.disabled = true;
            // Готовим расширенный payload с рецептами и состоянием тегов/категорий
            loadTagCategoryState();
            const payload = {
                recipes,
                tagCategoryState: {
                    tagCategoryMapping,
                    categoryList,
                    extraTagsList
                }
            };
            const body = {
                files: {
                    [filename]: { content: JSON.stringify(payload, null, 2) }
                }
            };
            const res = await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Не удалось сохранить в Gist: ${res.status} ${text}`);
            }
            const json = await res.json();
            const updatedRaw = json?.files?.[filename]?.raw_url;
            if (updatedRaw) {
                await configStore.set('gistRawUrl', updatedRaw);
                if (gistRawInput) gistRawInput.value = updatedRaw;
            }
            alert('Данные (рецепты и теги) сохранены в Gist');
        } catch (e) {
            alert(e.message);
        } finally {
            gistSaveBtn.disabled = false;
        }
    });



    // Загрузка изображений (локализовано внутри DOMContentLoaded)
    async function resizeToJpegLocal(file, maxDim = 1600, quality = 0.8) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            const scale = Math.min(1, maxDim / Math.max(width, height));
            width = Math.round(width * scale);
            height = Math.round(height * scale);
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (blob) resolve(blob); else resolve(file);
            }, 'image/jpeg', quality);
          };
          img.onerror = reject;
          img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    async function uploadToCloudinaryLocal(fileBlob) {
      const cloud = cloudNameInput?.value?.trim() || await configStore.get('cloudinaryCloud');
      const preset = cloudPresetInput?.value?.trim() || await configStore.get('cloudinaryPreset');
      const folder = cloudFolderInput?.value?.trim() || await configStore.get('cloudinaryFolder');
      if (!cloud || !preset) throw new Error('Заполните Cloud Name и Upload Preset');
      const fd = new FormData();
      fd.append('file', fileBlob);
      fd.append('upload_preset', preset);
      if (folder) fd.append('folder', folder);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || `Ошибка Cloudinary: ${res.status}`);
      return json.secure_url;
    }
    async function handleImageUploadLocal() {
      try {
        const file = imageFileInput?.files?.[0];
        if (!file) return alert('Выберите файл изображения');
        uploadImageBtn.disabled = true;
        const blob = await resizeToJpegLocal(file);
        const url = await uploadToCloudinaryLocal(blob);
        if (recipeImageInput) recipeImageInput.value = url;
        alert('Фото загружено');
      } catch (e) {
        alert(e.message);
      } finally {
        uploadImageBtn.disabled = false;
      }
    }
    uploadImageBtn?.addEventListener('click', handleImageUploadLocal);

    // Стартовый экран — новый рецепт
    setAdminView('new');

    clearBtn.addEventListener('click', clearForm);
    (async () => { await maybeAutoLoadGist(); displayAdminRecipes(); })();
});


async function resizeToJpeg(file, maxDim = 1600, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                const scale = Math.min(1, maxDim / Math.max(width, height));
                width = Math.round(width * scale);
                height = Math.round(height * scale);
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob); else resolve(file);
                }, 'image/jpeg', quality);
            };
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function uploadToCloudinary(fileBlob) {
    const cloud = cloudNameInput?.value?.trim() || await configStore.get('cloudinaryCloud');
    const preset = cloudPresetInput?.value?.trim() || await configStore.get('cloudinaryPreset');
    const folder = cloudFolderInput?.value?.trim() || await configStore.get('cloudinaryFolder');
    if (!cloud || !preset) throw new Error('Заполните Cloud Name и Upload Preset');
    const fd = new FormData();
    fd.append('file', fileBlob);
    fd.append('upload_preset', preset);
    if (folder) fd.append('folder', folder);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || `Ошибка Cloudinary: ${res.status}`);
    return json.secure_url;
}

async function handleImageUpload() {
    try {
        const file = imageFileInput?.files?.[0];
        if (!file) return alert('Выберите файл изображения');
        uploadImageBtn.disabled = true;
        const blob = await resizeToJpeg(file);
        const url = await uploadToCloudinary(blob);
        if (recipeImageInput) recipeImageInput.value = url;
        alert('Фото загружено');
    } catch (e) {
        alert(e.message);
    } finally {
        uploadImageBtn.disabled = false;
    }
}

// uploadImageBtn handler moved inside DOMContentLoaded to avoid scope issues