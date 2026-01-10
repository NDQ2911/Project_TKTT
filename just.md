# Cài đặt Just

[Just](https://github.com/casey/just) là một command runner giống Make nhưng đơn giản hơn.

## Cài đặt

### macOS

```bash
# Homebrew (khuyến nghị)
brew install just

# MacPorts
port install just
```

### Linux

```bash
# Ubuntu/Debian
sudo apt install just

# Arch Linux
sudo pacman -S just

# Cargo (cross-platform)
cargo install just
```

### Windows

```powershell
# Scoop
scoop install just

# Chocolatey
choco install just

# WinGet
winget install --id Casey.Just
```

## Kiểm tra

```bash
just --version
```

## Sử dụng cơ bản

```bash
# Liệt kê các recipes
just --list

# Chạy recipe mặc định
just

# Chạy recipe cụ thể
just dev
just build
just clean
```

## Recipes trong project này

| Command | Mô tả |
|---------|-------|
| `just dev` | Chạy frontend + backend development servers |
| `just backend` | Chỉ chạy backend server |
| `just frontend` | Chỉ chạy frontend server |

### Job Crawler (`cd job-crawler`)

| Command | Mô tả |
|---------|-------|
| `just build` | Build Docker images |
| `just up` | Start all crawler services |
| `just down` | Stop services |
| `just clean` | Stop + xóa volumes |
| `just stats` | Xem thống kê crawler |
| `just logs` | Xem logs |

## Tham khảo

- [Just Documentation](https://just.systems/man/en/)
- [GitHub Repository](https://github.com/casey/just)
