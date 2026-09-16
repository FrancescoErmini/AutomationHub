#!/usr/bin/env python3
import os, re, sys

SRC = "dump-pg16-automation_hub-202609041902-plain (1).sql"
OUT = "sql"
os.makedirs(OUT, exist_ok=True)

with open(SRC, encoding="utf-8") as f:
    lines = f.read().split("\n")

# ---------------------------------------------------------------------------
# 1. Split the dump into DDL head, COPY data blocks, and DDL tail
# ---------------------------------------------------------------------------
first_copy = next(i for i, l in enumerate(lines) if l.startswith("COPY "))
# tail starts after the LAST "\." terminator
last_term = max(i for i, l in enumerate(lines) if l.strip() == r"\.")
head = lines[:first_copy]
body = lines[first_copy:last_term + 1]
tail = lines[last_term + 1:]

def strip_noise(block):
    out = []
    for l in block:
        s = l.strip()
        if s.startswith("--"):
            continue
        if " OWNER TO " in l:
            continue
        out.append(l)
    # collapse blank runs
    res = []
    for l in out:
        if l.strip() == "" and (not res or res[-1].strip() == ""):
            continue
        res.append(l)
    return res

# ---------------------------------------------------------------------------
# 2. Parse COPY blocks -> rows
# ---------------------------------------------------------------------------
UNESC = {"N": None, "t": "\t", "n": "\n", "r": "\r", "\\": "\\",
         "b": "\b", "f": "\f", "v": "\v"}

def decode_field(tok):
    if tok == r"\N":
        return None
    out = []
    it = iter(range(len(tok)))
    i = 0
    while i < len(tok):
        c = tok[i]
        if c == "\\" and i + 1 < len(tok):
            nxt = tok[i + 1]
            out.append(UNESC.get(nxt, nxt))
            i += 2
        else:
            out.append(c)
            i += 1
    return "".join(out)

def sql_lit(v):
    if v is None:
        return "NULL"
    return "'" + v.replace("'", "''") + "'"

tables = []          # ordered list of (name, cols, rows)
i = 0
while i < len(body):
    l = body[i]
    m = re.match(r"COPY automation_hub\.(\w+) \((.*?)\) FROM stdin;", l)
    if m:
        name = m.group(1)
        cols = m.group(2)
        rows = []
        i += 1
        while body[i].strip() != r"\.":
            raw = body[i]
            fields = [decode_field(t) for t in raw.split("\t")]
            rows.append(fields)
            i += 1
        tables.append((name, cols, rows))
    i += 1

tbl = {name: (cols, rows) for name, cols, rows in tables}

def insert_sql(name, batch=50):
    cols, rows = tbl[name]
    if not rows:
        return f"-- {name}: no rows\n"
    chunks = []
    for start in range(0, len(rows), batch):
        part = rows[start:start + batch]
        vals = ",\n".join("(" + ", ".join(sql_lit(v) for v in r) + ")" for r in part)
        chunks.append(f"INSERT INTO automation_hub.{name} ({cols}) VALUES\n{vals};")
    return "\n\n".join(chunks) + "\n"

# ---------------------------------------------------------------------------
# 3. Parse tail -> setval / pk+unique constraints+indexes / FK constraints
# ---------------------------------------------------------------------------
tail_txt = "\n".join(strip_noise(tail))
stmts = [s.strip() + ";" for s in tail_txt.split(";\n") if s.strip()]
# last element may keep trailing junk
stmts = [re.sub(r";\s*;$", ";", s) for s in stmts]

setvals, pk_idx, fks = [], [], []
for s in stmts:
    s2 = s.strip()
    if not s2 or s2 == ";":
        continue
    if s2.startswith("SELECT pg_catalog.setval"):
        setvals.append(s2)
    elif "FOREIGN KEY" in s2:
        fks.append(s2)
    elif s2.startswith("ALTER TABLE") or s2.startswith("CREATE INDEX") or s2.startswith("CREATE UNIQUE INDEX"):
        pk_idx.append(s2)

# ---------------------------------------------------------------------------
# 4. Write files
# ---------------------------------------------------------------------------
HEADER = "-- Generated from {src}\n-- Run these files in order in the Cloud SQL query editor.\n\n".format(src=SRC)

def write(fn, content):
    with open(os.path.join(OUT, fn), "w", encoding="utf-8") as f:
        f.write(content)
    print(f"{fn}: {len(content.splitlines())} lines")

# --- 01 schema
schema = ["SET client_min_messages = warning;",
          "SET standard_conforming_strings = on;", ""]
for l in strip_noise(head):
    s = l.strip()
    if s.startswith("SET ") or s.startswith("SELECT pg_catalog.set_config"):
        continue
    schema.append(l)
write("01_schema.sql", HEADER + "\n".join(schema).strip() + "\n")

# dependency-ordered table list (parents before children)
order = [
    "alembic_version", "ams_year", "company", "department", "priority",
    "root_cause", "support_level", "application", "apqc_category",
    "reference_variable", "virtual_machine", "app_user", "tco_cost",
    "apqc_process_group", "apqc_process", "idea",
    "ams_1l_cost", "process", "license_cost", "vm_cost",
    "process_application", "process_economics", "process_schedule",
    "ams_rfc_cost", "ticket", "ams_2l_cost",
]
assert set(order) == set(tbl), set(order) ^ set(tbl)

MAX = 110_000            # target max chars per data file
seq = 1                  # data file counter (after 01_schema)
buf, buf_tables = [], []

def flush():
    global seq, buf, buf_tables
    if not buf:
        return
    seq += 1
    fn = (f"{seq:02d}_data_{buf_tables[0]}.sql" if len(buf_tables) == 1
          else f"{seq:02d}_data.sql")
    hdr = HEADER + "-- tables: " + ", ".join(buf_tables) + "\n\n"
    write(fn, hdr + "\n".join(buf).strip() + "\n")
    buf, buf_tables = [], []

for name in order:
    rows = tbl[name][1]
    body_sql = insert_sql(name)
    if len(body_sql) <= MAX:
        if buf and sum(len(x) for x in buf) + len(body_sql) > MAX:
            flush()
        buf.append(f"-- {name} ({len(rows)} rows)")
        buf.append(body_sql)
        buf_tables.append(name)
    else:
        # table too big for one file: emit it alone, split by row ranges
        flush()
        cols = tbl[name][0]
        per = max(1, len(rows) * MAX // len(body_sql))
        n_parts = (len(rows) + per - 1) // per
        for p in range(n_parts):
            sub = rows[p * per:(p + 1) * per]
            seq += 1
            vals = ",\n".join("(" + ", ".join(sql_lit(v) for v in r) + ")" for r in sub)
            txt = (HEADER + f"-- {name} rows {p*per+1}-{p*per+len(sub)} of {len(rows)} "
                   f"(part {p+1}/{n_parts})\n"
                   f"INSERT INTO automation_hub.{name} ({cols}) VALUES\n{vals};\n")
            write(f"{seq:02d}_data_{name}_part{p+1}.sql", txt)
flush()

seq += 1; write(f"{seq:02d}_constraints_indexes.sql", HEADER + "\n\n".join(pk_idx) + "\n")
seq += 1; write(f"{seq:02d}_foreign_keys.sql", HEADER + "\n\n".join(fks) + "\n")
seq += 1; write(f"{seq:02d}_sequences.sql", HEADER + "\n".join(setvals) + "\n")

print("\nTotal rows:", sum(len(r) for _, _, r in tables))
