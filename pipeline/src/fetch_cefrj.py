"""Baixa a CEFR-J Wordlist para PIPELINE_DATA_DIR (fora do repositório) e gera cefrj/lemmas.json.

Uso: python fetch_cefrj.py [--force]     (requer openpyxl)

Licença (página oficial, https://www.cefr-j.org/download.html): "the list can be used for both research
and commercial purposes with a proper acknowledgement of the source." Redistribuição NÃO é mencionada;
por isso o arquivo não é commitado. Em uso comercial com supervisão da equipe, a versão japonesa pede
consulta prévia. Citação: "The CEFR-J Wordlist Version 1.6. Compiled by Yukio Tono, Tokyo University of
Foreign Studies."
"""
import argparse
import json
import re
import urllib.request
import zipfile

import openpyxl

from vocab import ORDER, data_dir

URL = "https://www.cefr-j.org/data/CEFRJ_wordlist_ver1.6.zip"
CITATION = "The CEFR-J Wordlist Version 1.6. Compiled by Yukio Tono, Tokyo University of Foreign Studies."

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    d = data_dir() / "cefrj"
    d.mkdir(parents=True, exist_ok=True)
    z = d / "CEFRJ_wordlist_ver1.6.zip"
    if a.force or not z.exists():
        urllib.request.urlretrieve(URL, z)
    xlsx = next((p for p in d.glob("*.xlsx")), None)
    if a.force or xlsx is None:
        zipfile.ZipFile(z).extractall(d)
        xlsx = next(d.glob("*.xlsx"))
    wb = openpyxl.load_workbook(xlsx, read_only=True)
    lemmas = {}
    for headword, _pos, cefr, *_ in list(wb["ALL"].iter_rows(values_only=True))[1:]:
        if not headword or cefr not in ORDER:
            continue
        for w in str(headword).split("/"):
            w = w.strip().lower()
            if w and (w not in lemmas or ORDER[cefr] < ORDER[lemmas[w]]):
                lemmas[w] = cefr
    (d / "lemmas.json").write_text(json.dumps(lemmas, indent=0, sort_keys=True))
    (d / "ATTRIBUTION.txt").write_text(CITATION + "\nSource: https://www.cefr-j.org/download.html\n")
    print(f"{len(lemmas)} lemas em {d / 'lemmas.json'}\nCitação: {CITATION}")
