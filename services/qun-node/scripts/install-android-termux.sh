#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
REPO_URL="https://github.com/Serega40in/QUN.git"
INSTALL_DIR="$HOME/qun/QUN"
NODE_DIR="$INSTALL_DIR/services/qun-node"
DATA_DIR="$HOME/.local/share/qun-node"
echo
echo "QUN Node для Android / Termux"
echo "Это локальный тестовый узел; публичное подключение и начисление QUN не реализованы."
echo "Не храните личные данные в тестовом хранилище."
read -r -p "Продолжить? (y/N) " answer
case "$answer" in y|Y|д|Д) ;; *) echo "Отменено."; exit 0 ;; esac
if [ ! -d "${PREFIX:-/nonexistent}" ] || [[ "${PREFIX:-}" != *com.termux* ]]; then
  echo "Откройте Termux из доверенного источника и запустите скрипт внутри Termux."
  exit 1
fi
pkg update
pkg install -y nodejs-lts git
mkdir -p "$(dirname "$INSTALL_DIR")"
if [ ! -d "$INSTALL_DIR/.git" ]; then
  if [ -e "$INSTALL_DIR" ] && [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null || true)" ]; then
    echo "Каталог $INSTALL_DIR уже существует и не является репозиторием Git."
    exit 1
  fi
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
else
  echo "Репозиторий уже существует. Автоматическое обновление кода не выполняется."
fi
mkdir -p "$DATA_DIR"
cd "$NODE_DIR"
node --version
npm test
export QUN_NODE_HOST="127.0.0.1"
export QUN_NODE_PORT="8787"
export QUN_NODE_DATA_DIR="$DATA_DIR"
echo "Панель: http://127.0.0.1:8787/"
echo "Остановка: Ctrl+C. Android может приостанавливать фоновые процессы."
npm start
