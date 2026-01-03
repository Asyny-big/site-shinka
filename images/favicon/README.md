# Favicon для сайта «Шиномонтаж у Дениса»

## Исходный файл
- `favicon.svg` — векторная иконка колеса/шины

## Как сгенерировать PNG и ICO

### Вариант 1: Онлайн-сервисы (рекомендуется)
1. Откройте https://realfavicongenerator.net/
2. Загрузите `favicon.svg`
3. Скачайте готовый пакет иконок
4. Распакуйте в эту папку

### Вариант 2: Через ImageMagick (командная строка)
```bash
# Установка (Windows)
winget install ImageMagick.ImageMagick

# Генерация PNG
magick favicon.svg -resize 16x16 favicon-16.png
magick favicon.svg -resize 32x32 favicon-32.png
magick favicon.svg -resize 180x180 apple-touch-icon.png
magick favicon.svg -resize 192x192 android-192.png
magick favicon.svg -resize 512x512 android-512.png

# Генерация ICO (мульти-размер)
magick favicon.svg -define icon:auto-resize=16,32,48,64 favicon.ico
```

### Вариант 3: Через Inkscape
```bash
inkscape favicon.svg --export-type=png --export-filename=favicon-16.png -w 16 -h 16
inkscape favicon.svg --export-type=png --export-filename=favicon-32.png -w 32 -h 32
inkscape favicon.svg --export-type=png --export-filename=favicon-180.png -w 180 -h 180
inkscape favicon.svg --export-type=png --export-filename=android-192.png -w 192 -h 192
inkscape favicon.svg --export-type=png --export-filename=android-512.png -w 512 -h 512
```

## Структура после генерации
```
/images/favicon/
├── favicon.svg          ← исходник (уже есть)
├── favicon.ico          ← для старых браузеров
├── favicon-16.png       ← 16×16
├── favicon-32.png       ← 32×32
├── apple-touch-icon.png ← 180×180 для iOS
├── android-192.png      ← 192×192 для Android
└── android-512.png      ← 512×512 для PWA
```

## Подключение в HTML
Уже добавлено в `index.html` в разделе `<head>`.
