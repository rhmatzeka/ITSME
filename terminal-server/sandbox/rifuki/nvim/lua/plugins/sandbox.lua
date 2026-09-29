-- Khusus terminal pengunjung: kontainer tanpa internet dan tanpa program luar.
-- Plugin bawaan NvChad yang butuh jaringan atau server bahasa dimatikan, dan
-- treesitter tidak mencoba mengunduh parser (sudah dipasang saat build).
return {
    { "mason-org/mason.nvim", enabled = false },
    { "neovim/nvim-lspconfig", enabled = false },
    { "stevearc/conform.nvim", enabled = false },
    {
        "nvim-treesitter/nvim-treesitter",
        opts = function(_, opts)
            opts.ensure_installed = {}
            opts.auto_install = false
            return opts
        end,
    },
    {
        -- tidak ada trash-cli di kontainer: `d` di pohon berkas menghapus biasa;
        -- dan pohonnya tetap di folder rumah
        "nvim-tree/nvim-tree.lua",
        opts = function(_, opts)
            opts.trash = nil
            -- pohon berkas tidak bisa naik ke atas folder tempat nvim dibuka (~)
            opts.actions = vim.tbl_deep_extend("force", opts.actions or {}, {
                change_dir = { restrict_above_cwd = true },
            })
            local lama = opts.on_attach
            opts.on_attach = function(bufnr)
                if lama then lama(bufnr) end
                local api = require("nvim-tree.api")
                vim.keymap.set("n", "d", api.fs.remove, { buffer = bufnr, desc = "nvim-tree: Delete", nowait = true, silent = true })
            end
            return opts
        end,
    },
}
