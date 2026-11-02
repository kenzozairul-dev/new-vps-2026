#!/usr/bin/env python3
"""Repo Switcher - tukar semua rujukan GitHub dalam folder skrip VPS.

Guna: python tools/repo_switcher.py
Atau: python tools/repo_switcher.py --old owner/repo --new owner2/repo2 --path .
"""

import argparse
import os
import re
import sys
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

TEXT_EXT = {
    ".sh", ".py", ".conf", ".ini", ".txt", ".json", ".js", ".css",
    ".md", ".yml", ".yaml", ".php", ".service", ".cfg", ".list",
}
NO_EXT_OK = {
    "changelog", "dependencies", "clgshow", "newmenu.sh", "setup.sh",
    "ascii-home", "versi", "ip", "bot", "password", "newudpgw", "proxy3.js",
}
SKIP_DIRS = {".git", "__pycache__", "node_modules", ".venv", "venv"}

PATTERNS = [
    (r"(raw\.githubusercontent\.com/)([^/\s\"'`]+)/([^/\s\"'`]+)", 2),
    (r"(cdn\.jsdelivr\.net/gh/)([^/\s\"'`]+)/([^/\s\"'`]+)", 2),
    (r"(github\.com/)([^/\s\"'`]+)/([^/\s\"'`]+?)(\.git)?(?=[/\s\"'`]|$)", 2),
]


def should_scan(path: str) -> bool:
    name = os.path.basename(path).lower()
    ext = os.path.splitext(name)[1]
    if ext in TEXT_EXT:
        return True
    if not ext and name in NO_EXT_OK:
        return True
    return False


def scan(root: str, old_owner: str, old_repo: str):
    """Kembalikan (fail, kiraan) yang mengandungi rujukan repo lama."""
    hits = []
    needle_owner = old_owner.lower()
    needle_repo = old_repo.lower()
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            full = os.path.join(dirpath, fn)
            if not should_scan(full):
                continue
            try:
                with open(full, "r", encoding="utf-8", errors="ignore") as fh:
                    text = fh.read()
            except OSError:
                continue
            count = 0
            for pattern, _ in PATTERNS:
                for m in re.finditer(pattern, text):
                    if (
                        m.group(2).lower() == needle_owner
                        and m.group(3).lower().removesuffix(".git") == needle_repo
                    ):
                        count += 1
            if count:
                hits.append((full, count))
    return hits


def _sub_only_old(m, old_owner, old_repo, new_owner, new_repo):
    owner = m.group(2)
    repo = m.group(3)
    if owner.lower() != old_owner.lower() or repo.lower() != old_repo.lower():
        return m.group(0)
    suffix = ""
    if m.lastindex and m.lastindex >= 4 and m.group(4):
        suffix = m.group(4)
    return m.group(1) + new_owner + "/" + new_repo + suffix


def replace_all(root: str, old_owner: str, old_repo: str, new_owner: str, new_repo: str, dry_run=False):
    """Ganti owner/repo lama kepada baru. Kembalikan (fail_diubah, jumlah_ganti)."""
    changed_files = 0
    total = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            full = os.path.join(dirpath, fn)
            if not should_scan(full):
                continue
            try:
                with open(full, "r", encoding="utf-8", errors="ignore") as fh:
                    text = fh.read()
            except OSError:
                continue

            count = 0
            for pattern, _ in PATTERNS:
                text, n = re.subn(
                    pattern,
                    lambda m: _sub_only_old(m, old_owner, old_repo, new_owner, new_repo),
                    text,
                    flags=re.IGNORECASE,
                )
                count += n

            if count and not dry_run:
                with open(full, "w", encoding="utf-8", newline="") as fh:
                    fh.write(text)
            if count:
                changed_files += 1
                total += count
    return changed_files, total


def parse_pair(value: str):
    value = value.strip().rstrip("/")
    value = re.sub(r"^(https?://)?(raw\.githubusercontent\.com|cdn\.jsdelivr\.net/gh|github\.com)/", "", value)
    parts = [p for p in value.split("/") if p]
    if len(parts) < 2:
        raise ValueError(f"Format salah: {value}. Guna owner/repo")
    repo = parts[1]
    if repo.endswith(".git"):
        repo = repo[:-4]
    return parts[0], repo


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Repo Switcher - Tukar GitHub Repo")
        self.geometry("780x620")
        self.minsize(700, 560)
        self.configure(bg="#1e1e2e")

        self.target_dir = tk.StringVar(value=os.getcwd())
        self.old_repo = tk.StringVar(value="kenzozairul-dev/new-vps-2026")
        self.new_repo = tk.StringVar()
        self.status = tk.StringVar(value="Sedia.")

        self._build()

    def _build(self):
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure("TLabel", background="#1e1e2e", foreground="#cdd6f4", font=("Segoe UI", 10))
        style.configure("Header.TLabel", font=("Segoe UI", 16, "bold"), foreground="#89b4fa")
        style.configure("TButton", font=("Segoe UI", 10), padding=6)
        style.configure("Accent.TButton", font=("Segoe UI", 10, "bold"), padding=8)
        style.configure("TEntry", padding=4)
        style.configure("TFrame", background="#1e1e2e")

        pad = {"padx": 18, "pady": 6}

        ttk.Label(self, text="Repo Switcher", style="Header.TLabel").pack(anchor="w", padx=18, pady=(16, 2))
        ttk.Label(self, text="Tukar semua rujukan raw/github URL dalam folder skrip VPS kepada repo GitHub lain.").pack(anchor="w", padx=18)

        box = ttk.Frame(self)
        box.pack(fill="x", **pad)

        ttk.Label(box, text="Folder skrip").grid(row=0, column=0, sticky="w", pady=(8, 2))
        ttk.Entry(box, textvariable=self.target_dir).grid(row=1, column=0, sticky="ew", ipady=3)
        ttk.Button(box, text="Pilih...", command=self.pick_dir).grid(row=1, column=1, padx=(8, 0))
        box.columnconfigure(0, weight=1)

        ttk.Label(box, text="Repo lama (owner/repo)").grid(row=2, column=0, sticky="w", pady=(14, 2))
        ttk.Entry(box, textvariable=self.old_repo).grid(row=3, column=0, columnspan=2, sticky="ew", ipady=3)

        ttk.Label(box, text="Repo baru (owner/repo)").grid(row=4, column=0, sticky="w", pady=(14, 2))
        ttk.Entry(box, textvariable=self.new_repo).grid(row=5, column=0, columnspan=2, sticky="ew", ipady=3)

        ttk.Label(box, text="Contoh: kenzozairul-dev/new-vps-2026  |  Boleh tampal URL penuh github/raw terus.").grid(
            row=6, column=0, columnspan=2, sticky="w", pady=(4, 0)
        )

        btns = ttk.Frame(self)
        btns.pack(fill="x", **pad)
        ttk.Button(btns, text="Scan Sahaja", command=self.do_scan).pack(side="left")
        ttk.Button(btns, text="Tukar Sekarang", style="Accent.TButton", command=self.do_replace).pack(side="left", padx=8)
        ttk.Button(btns, text="Padam Log", command=lambda: self._clear_log()).pack(side="right")

        self.log = tk.Text(self, bg="#11111b", fg="#a6e3a1", insertbackground="#cdd6f4",
                           font=("Consolas", 9), relief="flat", wrap="word")
        self.log.pack(fill="both", expand=True, padx=18, pady=(0, 6))

        ttk.Label(self, textvariable=self.status).pack(anchor="w", padx=18, pady=(0, 12))

    def pick_dir(self):
        d = filedialog.askdirectory(initialdir=self.target_dir.get() or os.getcwd())
        if d:
            self.target_dir.set(d)

    def _clear_log(self):
        self.log.delete("1.0", tk.END)

    def _write(self, msg):
        self.log.insert(tk.END, msg + "\n")
        self.log.see(tk.END)

    def _validate(self):
        path = self.target_dir.get().strip()
        if not os.path.isdir(path):
            messagebox.showerror("Ralat", "Folder tidak wujud.")
            return None
        try:
            old_owner, old_name = parse_pair(self.old_repo.get())
            new_owner, new_name = parse_pair(self.new_repo.get())
        except ValueError as exc:
            messagebox.showerror("Ralat", str(exc))
            return None
        if (old_owner, old_name) == (new_owner, new_name):
            messagebox.showwarning("Sama", "Repo lama dan baru sama.")
            return None
        return path, old_owner, old_name, new_owner, new_name

    def do_scan(self):
        v = self._validate()
        if not v:
            return
        path, oo, on, _, _ = v
        self.status.set("Menycan...")
        self.update_idletasks()
        hits = scan(path, oo, on)
        self._clear_log()
        self._write(f"Scan: {oo}/{on} dalam {path}")
        if not hits:
            self._write("Tiada rujukan dijumpai.")
            self.status.set("Tiada rujukan.")
            return
        total = 0
        for f, c in sorted(hits, key=lambda x: -x[1]):
            total += c
            self._write(f"  {c:>4}x  {os.path.relpath(f, path)}")
        self._write(f"\nJumlah: {len(hits)} fail, {total} rujukan.")
        self.status.set(f"{len(hits)} fail, {total} rujukan.")

    def do_replace(self):
        v = self._validate()
        if not v:
            return
        path, oo, on, no, nn = v
        if not messagebox.askyesno(
            "Sahkan",
            f"Tukar semua {oo}/{on}\nkepada {no}/{nn}\ndalam:\n{path}\n\nTeruskan?",
        ):
            return
        self.status.set("Menukar...")
        self.update_idletasks()

        def work():
            files, total = replace_all(path, oo, on, no, nn)
            self.after(0, lambda: self._done(files, total, oo, on, no, nn))

        threading.Thread(target=work, daemon=True).start()

    def _done(self, files, total, oo, on, no, nn):
        self._clear_log()
        self._write(f"Selesai! {files} fail diubah, {total} rujukan diganti.")
        self._write(f"  {oo}/{on}  ->  {no}/{nn}")
        self.status.set(f"Selesai: {files} fail, {total} rujukan.")
        if files:
            messagebox.showinfo("Selesai", f"{files} fail diubah.\n{total} rujukan diganti.")


def main():
    ap = argparse.ArgumentParser(description="Tukar rujukan GitHub repo dalam folder skrip VPS.")
    ap.add_argument("--old", help="repo lama, contoh owner/repo")
    ap.add_argument("--new", help="repo baru, contoh owner2/repo2")
    ap.add_argument("--path", default=os.getcwd(), help="folder sasaran")
    ap.add_argument("--scan", action="store_true", help="scan sahaja, tiada perubahan")
    args = ap.parse_args()

    if args.old and args.new:
        oo, on = parse_pair(args.old)
        no, nn = parse_pair(args.new)
        if args.scan:
            hits = scan(args.path, oo, on)
            total = sum(c for _, c in hits)
            for f, c in sorted(hits, key=lambda x: -x[1]):
                print(f"{c:>4}x  {os.path.relpath(f, args.path)}")
            print(f"\nJumlah: {len(hits)} fail, {total} rujukan.")
        else:
            files, total = replace_all(args.path, oo, on, no, nn)
            print(f"Selesai: {files} fail, {total} rujukan diganti.")
        return 0

    App().mainloop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
