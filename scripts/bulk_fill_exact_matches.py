import json
import re
import unicodedata
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(r"C:/Users/juani/Projects/DaniMarin")
WB_PATH = ROOT / "datasheet 20_to_fill.xlsx"
JSON_PATH = ROOT / "tmp/doc-analyzer-chats.json"
OUTDIR = ROOT / "extracted_data"

REMAINING = [
    (16, 70), (17, 69), (18, 68), (19, 67), (20, 66), (21, 65), (23, 64),
    (24, 63), (28, 60), (29, 59), (30, 58), (32, 57), (33, 56), (34, 55),
    (35, 54), (36, 53), (37, 52), (38, 51), (46, 48), (49, 47), (50, 46),
    (52, 44), (53, 43), (54, 45), (57, 42), (60, 39), (74, 28), (87, 18),
    (88, 17), (90, 15), (92, 13), (94, 11), (96, 9), (97, 8), (98, 7),
    (102, 3), (103, 2),
]

COL_MAP = {
    1: "E", 2: "F", 3: "G", 4: "H", 5: "I", 6: "J", 7: "K", 8: "L", 9: "M",
    10: "N", 11: "O", 12: "P", 13: "Q", 14: "R", 15: "S", 16: "T", 17: "U",
    18: "V", 19: "W", 20: "X",
}


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:180] or "article"


def clean(text: str) -> str:
    text = (text or "").replace("\r", "\n")
    text = re.sub(r"PAGE!\d+", "", text)
    text = text.replace("\u202f", " ").replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_sections(answer: str) -> dict[int, str]:
    txt = "\n" + answer.strip()
    patterns = [
        re.compile(r"\n\**\s*(\d{1,2})\.?\s*[^\n]*\n"),
        re.compile(r"\n\s*(\d{1,2})\.\s+[^\n]*\n"),
    ]
    for pattern in patterns:
        matches = list(pattern.finditer(txt))
        if len(matches) >= 10:
            sections = {}
            for i, match in enumerate(matches):
                num = int(match.group(1))
                start = match.end()
                end = matches[i + 1].start() if i + 1 < len(matches) else len(txt)
                sections[num] = clean(txt[start:end])
            return sections
    return {}


def is_exclusion(answer: str) -> bool:
    low = answer.lower()
    return (
        ("criterio" in low and "exclus" in low and ("sí cumple" in low or "si cumple" in low))
        or ("review" in low and "no presenta datos emp" in low)
        or ("es una revisión" in low and "no presenta datos emp" in low)
    )


def compact(text: str) -> str:
    text = re.sub(r"^[-*]\s*", "", text, flags=re.M)
    text = text.replace("|", " ")
    text = re.sub(r"\n+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def main() -> None:
    OUTDIR.mkdir(exist_ok=True)
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))["chats"]
    wb = load_workbook(WB_PATH)
    ws = wb["Hoja2"]
    processed = []

    for row, idx in REMAINING:
        title = ws[f"B{row}"].value
        if not title:
            continue
        values = [ws.cell(row, c).value for c in range(5, 25)]
        if all(v not in (None, "") for v in values):
            continue

        chat = data[idx]
        answer = clean(chat.get("queries", [])[-1].get("answer", "") if chat.get("queries") else "")
        doc = chat.get("documents", [{}])[0]
        insight = doc.get("insight") or {}
        insight_title = insight.get("title") or doc.get("name") or doc.get("filename") or title
        thread = chat.get("thread", {}).get("title", "")

        md = [
            f"# {title}",
            "",
            "## Fuente",
            f"- Chat title: {thread}",
            f"- Documento: {doc.get('name') or doc.get('filename') or title}",
            f"- Insight title: {insight_title}",
            "",
            "## Extraccion",
            answer or "Sin respuesta estructurada en el chat.",
        ]
        (OUTDIR / f"{slugify(title)}.md").write_text("\n".join(md), encoding="utf-8")

        if is_exclusion(answer):
            first_para = clean(answer.split("\n\n")[0])
            ws[f"D{row}"] = first_para[:500]
            processed.append((row, "excluded"))
            continue

        sections = extract_sections(answer)
        if not sections:
            processed.append((row, "unparsed"))
            continue

        for num in range(1, 21):
            body = sections.get(num)
            if body:
                ws[f"{COL_MAP[num]}{row}"] = compact(body)[:32760]
        processed.append((row, "filled", len(sections)))

    wb.save(WB_PATH)
    print(f"processed {len(processed)} rows")
    for item in processed:
        print(item)


if __name__ == "__main__":
    main()
