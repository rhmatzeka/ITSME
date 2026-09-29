-- Khusus terminal pengunjung: Neovim tetap di folder rumah (~), sama seperti
-- `cd` di zsh. Folder sistem memang hanya-baca dan tidak bisa dibuka isinya,
-- tapi akar (/) selalu terbaca di kontainer; tanpa ini pohon berkas dan `:cd`
-- bisa berjalan-jalan ke sana, dan `:e` membuka berkas sistem.
local rumah = vim.fs.normalize(vim.uv.os_homedir() or "/home/tamu")

local function di_rumah(p)
    p = vim.fs.normalize(p)
    return p == rumah or vim.startswith(p, rumah .. "/")
end

-- berkas bawaan Neovim & plugin (bantuan :h, dsb.) tetap boleh dibuka
local boleh = { vim.fs.normalize(vim.env.VIMRUNTIME or "/opt/nvim"), "/opt/nvim", "/usr/share/mapporto-nvim" }
local function bawaan(p)
    for _, akar in ipairs(boleh) do
        if vim.startswith(p, akar .. "/") then return true end
    end
    return false
end

local function tegur()
    vim.notify("You can only use your home folder (~)", vim.log.levels.WARN)
end

vim.api.nvim_create_autocmd("DirChanged", {
    desc = "Kembali ke ~ kalau pindah folder ke luar rumah",
    callback = function()
        if di_rumah(vim.fn.getcwd()) then return end
        vim.schedule(function()
            vim.cmd.cd(vim.fn.fnameescape(rumah))
            tegur()
        end)
    end,
})

vim.api.nvim_create_autocmd({ "BufReadPost", "BufNewFile" }, {
    desc = "Tolak berkas di luar rumah",
    callback = function(ev)
        if vim.bo[ev.buf].buftype ~= "" then return end
        local nama = vim.api.nvim_buf_get_name(ev.buf)
        if nama == "" then return end
        local penuh = vim.fs.normalize(vim.fn.fnamemodify(nama, ":p"))
        if di_rumah(penuh) or bawaan(penuh) then return end
        vim.schedule(function()
            if vim.api.nvim_buf_is_valid(ev.buf) then
                pcall(vim.api.nvim_buf_delete, ev.buf, { force = true })
            end
            tegur()
        end)
    end,
})
