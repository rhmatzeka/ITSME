-- Config Neovim rifuki (github.com/rifuki/dotfiles, shared/.config/nvim), versi
-- terminal pengunjung Desa Mapporto: NvChad + tema, UI, treesitter, dan
-- completion sama persis; AI, LSP/Mason, Rust, Discord, wakatime, dan gambar
-- tidak ikut (kontainernya tanpa internet dan cuma 96 MB). Semua plugin sudah
-- dipasang saat image dibangun (lihat Dockerfile); lihat juga plugins/sandbox.lua.
vim.g.base46_cache = vim.fn.stdpath("data") .. "/base46/"
vim.g.mapleader = " "

-- bootstrap lazy and all plugins
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"

if not vim.uv.fs_stat(lazypath) then
    local repo = "https://github.com/folke/lazy.nvim.git"
    vim.fn.system({ "git", "clone", "--filter=blob:none", repo, "--branch=stable", lazypath })
end

vim.opt.rtp:prepend(lazypath)

local lazy_config = require("configs.lazy")
-- terminal pengunjung: cache bytecode Lua (±1,5 MB di ~/.cache/nvim/luac)
-- tidak ditulis — folder rumah pengunjung cuma 4 MB
lazy_config.performance = vim.tbl_deep_extend("force", lazy_config.performance or {}, { cache = { enabled = false } })

-- load plugins
require("lazy").setup({
    {
        "NvChad/NvChad",
        lazy = false,
        branch = "v2.5",
        import = "nvchad.plugins",
    },

    { import = "plugins" },
    { import = "plugins.editor" },
    { import = "plugins.ui" },
}, lazy_config)

-- load theme
dofile(vim.g.base46_cache .. "defaults")
dofile(vim.g.base46_cache .. "statusline")

require("nvchad.options")
require("nvchad.autocmds")

-- Load custom configs
require("custom.options")
require("custom.autocmds")
-- terminal pengunjung: tetap di folder rumah (lihat lua/custom/rumah.lua)
require("custom.rumah")

vim.schedule(function()
    require("mappings")
end)
