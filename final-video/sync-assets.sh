#!/bin/bash

# Скрипт для синхронизации ресурсов из родительской директории

# Копируем temp и output в public
cp -r ../temp public/
cp -r ../output/* public/

echo "✅ Ресурсы синхронизированы в public/"

