# Import automation_hub nel Cloud SQL (GCP)

Generati da `dump-pg16-automation_hub-202609041902-plain (1).sql`.
Il dump originale usa `COPY ... FROM stdin` che **non funziona** nel query editor
di Cloud SQL Studio: qui è tutto convertito in `INSERT` normali.

## Ordine di esecuzione

Apri il Cloud SQL query editor, incolla ed esegui **un file alla volta, in ordine**:

| # | File | Cosa fa |
|---|------|---------|
| 1 | `01_schema.sql` | `CREATE SCHEMA automation_hub`, tutte le tabelle, le sequence, i default `nextval` |
| 2 | `02_data.sql` | dati tabelle senza dipendenze (ams_year, company, department, priority, root_cause, support_level, application, apqc_category, reference_variable, virtual_machine, app_user, tco_cost, alembic_version, apqc_process_group) |
| 3 | `03_data.sql` | apqc_process, idea, ams_1l_cost |
| 4 | `04_data.sql` | process, license_cost, vm_cost, process_application, process_economics, process_schedule, ams_rfc_cost |
| 5 | `05_data_ticket_part1.sql` | ticket (righe 1–408) |
| 6 | `06_data_ticket_part2.sql` | ticket (righe 409–760) |
| 7 | `07_data_ams_2l_cost.sql` | ams_2l_cost |
| 8 | `08_constraints_indexes.sql` | primary key, unique, indici |
| 9 | `09_foreign_keys.sql` | foreign key |
| 10 | `10_sequences.sql` | `setval` delle sequence al valore corretto |

L'ordine dei file rispetta le dipendenze FK. Le foreign key vengono aggiunte
solo alla fine (file 9), quindi anche se salti un blocco dati te ne accorgi lì.

## Note

- Nessun comando `OWNER TO` / `GRANT`: il proprietario sarà l'utente con cui esegui.
- Se il target **non** è uno schema vuoto, prima: `DROP SCHEMA IF EXISTS automation_hub CASCADE;`
- Tutti i valori sono passati come stringhe quotate; Postgres li converte in
  base al tipo colonna (numeri, date, boolean `t`/`f`).
- Verificato: caricamento completo su un Postgres 16 pulito, 1851 righe, FK e
  sequence OK.
