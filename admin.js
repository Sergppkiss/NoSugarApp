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
            if (!Array.isArray(data)) return console.warn('Gist JSON expected array');
            recipes = data;
            saveRecipes();
            await configStore.set('lastGistSync', String(Date.now()));
            console.log('Admin: recipes auto-loaded from Gist', data.length);
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
            if (!Array.isArray(data)) throw new Error('Ожидается JSON-массив рецептов');
            recipes = data;
            saveRecipes();
            displayAdminRecipes();
            alert('Рецепты загружены из Gist');
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
            const body = {
                files: {
                    [filename]: { content: JSON.stringify(recipes, null, 2) }
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
            alert('Рецепты сохранены в Gist');
        } catch (e) {
            alert(e.message);
        } finally {
            gistSaveBtn.disabled = false;
        }
    });

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

uploadImageBtn?.addEventListener('click', handleImageUpload);