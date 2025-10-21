window.recipes = [
    {
        id: 1,
        name: 'Омлет с овощами и сыром',
        category: 'Завтрак',
        image: 'images/omelette.jpg',
        calories: 280,
        cookingTime: 15,
        ingredients: [
            { name: 'Яйца', quantity: '3 шт' },
            { name: 'Помидор', quantity: '1 шт' },
            { name: 'Шампиньоны', quantity: '50г' },
            { name: 'Твердый сыр', quantity: '30г' },
            { name: 'Зелень', quantity: 'по вкусу' }
        ],
        tags: ['яйцо', 'помидор', 'шампиньон', 'сыр', 'зелень'],
        instructions: 'Взбить яйца. Нарезать овощи и грибы, обжарить на сковороде. Залить яйцами, посыпать тертым сыром. Готовить под крышкой до готовности.'
    },
    {
        id: 2,
        name: 'Куриная грудка с брокколи',
        category: 'Обед',
        image: 'images/chicken_broccoli.jpg',
        calories: 320,
        cookingTime: 25,
        ingredients: [
            { name: 'Куриная грудка', quantity: '200г' },
            { name: 'Брокколи', quantity: '150г' },
            { name: 'Чеснок', quantity: '2 зубчика' },
            { name: 'Оливковое масло', quantity: '1 ст.л.' }
        ],
        tags: ['курица', 'брокколи', 'чеснок'],
        instructions: 'Куриную грудку нарезать, обжарить с измельченным чесноком. Брокколи отварить на пару. Подавать вместе.'
    },
    {
        id: 3,
        name: 'Салат с тунцом и авокадо',
        category: 'Ужин',
        image: 'images/tuna_avocado_salad.jpg',
        calories: 250,
        cookingTime: 10,
        ingredients: [
            { name: 'Тунец консервированный', quantity: '1 банка' },
            { name: 'Авокадо', quantity: '1 шт' },
            { name: 'Огурец', quantity: '1 шт' },
            { name: 'Красный лук', quantity: '1/4 шт' }
        ],
        tags: ['тунец', 'авокадо', 'огурец', 'лук'],
        instructions: 'Все ингредиенты нарезать, смешать. Заправить оливковым маслом и лимонным соком.'
    },
    {
        id: 4,
        name: 'Творог с ягодами и орехами',
        category: 'Перекус',
        image: 'images/cottage_cheese_berries.jpg',
        calories: 180,
        cookingTime: 5,
        ingredients: [
            { name: 'Творог 5%', quantity: '150г' },
            { name: 'Голубика', quantity: '50г' },
            { name: 'Миндаль', quantity: '20г' }
        ],
        tags: ['творог', 'голубика', 'миндаль', 'ягода'],
        instructions: 'Смешать творог с ягодами и посыпать измельченными орехами.'
    },
    {
        id: 5,
        name: 'Чиа-пудинг на кокосовом молоке',
        category: 'Десерт',
        image: 'images/chia_pudding.jpg',
        calories: 220,
        cookingTime: 480,
        ingredients: [
            { name: 'Семена чиа', quantity: '3 ст.л.' },
            { name: 'Кокосовое молоко', quantity: '200мл' },
            { name: 'Ягоды для украшения', quantity: 'по вкусу' }
        ],
        tags: ['чиа', 'кокосовое молоко', 'ягода'],
        instructions: 'Смешать семена чиа с кокосовым молоком и оставить на ночь в холодильнике. Перед подачей украсить ягодами.'
    },
    {
        id: 6,
        name: 'Куриный суп с лапшой',
        category: 'Обед',
        image: 'images/chicken_noodle_soup.jpg',
        calories: 290,
        cookingTime: 45,
        ingredients: [
            { name: 'Куриное филе', quantity: '300г' },
            { name: 'Яичная лапша', quantity: '50г' },
            { name: 'Морковь', quantity: '1 шт' },
            { name: 'Луковица', quantity: '1 шт' }
        ],
        tags: ['курица', 'лапша', 'морковь', 'лук'],
        instructions: 'Сварить куриный бульон. Добавить нарезанные овощи. За 10 минут до готовности всыпать лапшу. Подавать с зеленью.'
    },
    {
        id: 7,
        name: 'Лосось на пару со спаржей',
        category: 'Ужин',
        image: 'images/salmon_asparagus.jpg',
        calories: 340,
        cookingTime: 20,
        ingredients: [
            { name: 'Филе лосося', quantity: '200г' },
            { name: 'Спаржа', quantity: '150г' },
            { name: 'Лимон', quantity: '1/2 шт' }
        ],
        tags: ['лосось', 'спаржа', 'лимон'],
        instructions: 'Готовить лосось и спаржу на пару 15-20 минут. Перед подачей сбрызнуть лимонным соком.'
    },
    {
        id: 8,
        name: 'Гречневая каша с грибами',
        category: 'Обед',
        image: 'images/buckwheat_mushrooms.jpg',
        calories: 260,
        cookingTime: 30,
        ingredients: [
            { name: 'Гречневая крупа', quantity: '100г' },
            { name: 'Шампиньоны', quantity: '100г' },
            { name: 'Лук репчатый', quantity: '1 шт' }
        ],
        tags: ['гречка', 'шампиньон', 'лук'],
        instructions: 'Отварить гречку. Лук и грибы нарезать и обжарить. Смешать с готовой кашей.'
    },
    {
        id: 9,
        name: 'Салат "Греческий"',
        category: 'Ужин',
        image: 'images/greek_salad.jpg',
        calories: 200,
        cookingTime: 15,
        ingredients: [
            { name: 'Помидоры', quantity: '2 шт' },
            { name: 'Огурцы', quantity: '1 шт' },
            { name: 'Болгарский перец', quantity: '1 шт' },
            { name: 'Сыр Фета', quantity: '100г' },
            { name: 'Оливки', quantity: '50г' }
        ],
        tags: ['помидор', 'огурец', 'перец', 'сыр фета', 'оливки'],
        instructions: 'Крупно нарезать овощи. Добавить сыр кубиками и оливки. Заправить оливковым маслом.'
    },
    {
        id: 10,
        name: 'Овсяноблин с бананом и творогом',
        category: 'Завтрак',
        image: 'images/oat_pancake.jpg',
        calories: 310,
        cookingTime: 12,
        ingredients: [
            { name: 'Овсяные хлопья', quantity: '4 ст.л.' },
            { name: 'Яйцо', quantity: '1 шт' },
            { name: 'Молоко', quantity: '4 ст.л.' },
            { name: 'Банан', quantity: '1/2 шт' },
            { name: 'Творог', quantity: '50г' }
        ],
        tags: ['овсянка', 'яйцо', 'молоко', 'банан', 'творог'],
        instructions: 'Смешать овсянку, яйцо и молоко в блендере. Выпекать на сковороде как блин. Завернуть в него нарезанный банан и творог.'
    },
    {
        id: 11,
        name: 'Запеканка из цветной капусты',
        category: 'Обед',
        image: 'images/cauliflower_casserole.jpg',
        calories: 240,
        cookingTime: 35,
        ingredients: [
            { name: 'Цветная капуста', quantity: '400г' },
            { name: 'Яйца', quantity: '2 шт' },
            { name: 'Твердый сыр', quantity: '50г' },
            { name: 'Натуральный йогурт', quantity: '100г' }
        ],
        tags: ['цветная капуста', 'яйцо', 'сыр', 'йогурт'],
        instructions: 'Капусту разобрать на соцветия и отварить. Яйца взбить с йогуртом. Залить капусту, посыпать сыром и запекать 20 минут при 180°C.'
    },
    {
        id: 12,
        name: 'Смузи "Зеленый детокс"',
        category: 'Перекус',
        image: 'images/green_smoothie.jpg',
        calories: 120,
        cookingTime: 5,
        ingredients: [
            { name: 'Шпинат', quantity: '1 горсть' },
            { name: 'Яблоко', quantity: '1 шт' },
            { name: 'Огурец', quantity: '1/2 шт' },
            { name: 'Вода', quantity: '150мл' }
        ],
        tags: ['шпинат', 'яблоко', 'огурец'],
        instructions: 'Все ингредиенты взбить в блендере до однородной массы.'
    }
];


// Общая база данных по умолчанию (Gist RAW URL)
// Вставьте ваш стабильный RAW URL без ревизии, например:
// https://gist.githubusercontent.com/<user>/<gistId>/raw/recipes.json
// Тогда все клиенты будут использовать этот источник, если локальная ссылка не задана.
window.DEFAULT_GIST_RAW_URL = 'https://gist.githubusercontent.com/Sergppkiss/7bde33ffd0fdb57925274811b189760a/raw/recipes.json';