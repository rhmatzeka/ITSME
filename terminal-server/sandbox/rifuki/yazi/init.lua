-- yazi pengunjung: tetap di folder rumah (~), sama seperti `cd` di zsh.
-- Folder sistem memang tidak bisa dibuka isinya dan hanya-baca, tapi akar (/)
-- selalu terbaca di kontainer: tanpa ini `h` dari ~ membawa ke sana. Tiap kali
-- pindah folder ke luar ~, yazi langsung dikembalikan ke ~.
local rumah = os.getenv("HOME") or "/home/tamu"
local emit = ya.emit or ya.mgr_emit or ya.manager_emit

ps.sub("cd", function()
    local cwd = tostring(cx.active.current.cwd)
    if cwd == rumah or cwd:sub(1, #rumah + 1) == rumah .. "/" then
        return
    end
    emit("cd", { rumah })
    ya.notify({ title = "Home only", content = "You can only use your home folder (~)", timeout = 3, level = "warn" })
end)
