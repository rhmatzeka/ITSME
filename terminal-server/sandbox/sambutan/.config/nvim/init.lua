-- Neovim untuk pengunjung: rapi tapi ringan. Tidak ada plugin (kontainernya
-- tanpa internet), dan tidak ada berkas swap/shada supaya jatah 5 MB di
-- folder rumah tidak termakan.
vim.opt.number = true
vim.opt.relativenumber = false
vim.opt.cursorline = true
vim.opt.expandtab = true
vim.opt.shiftwidth = 4
vim.opt.tabstop = 4
vim.opt.smartindent = true
vim.opt.mouse = 'a'
vim.opt.termguicolors = true
vim.opt.swapfile = false
vim.opt.backup = false
vim.opt.undofile = false
vim.opt.shada = ''
vim.cmd('syntax on')
pcall(vim.cmd, 'colorscheme habamax')
