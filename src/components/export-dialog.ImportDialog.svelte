<script lang="ts">import { initialState } from '@/shared/svelte-runtime';

import Papa from "papaparse";
import { Download, Upload } from "@lucide/svelte";
import type { RecordData, RecordKind } from "@/shared/contracts";
import { localDate, post } from "@/shared/client-api";
import { Button, ErrorMessage, Modal } from "./ui";
import { isActiveStaff } from "@/shared/client-members";
import { useWorkspace } from "./workspace-context";
import { fields, labels } from "./resource-fields";
import { createEffects, createId, externalStore, styleString, applyRef } from "@/shared/svelte-runtime";
import type { ReactNode, CSSProperties, Dispatch, SetStateAction, FormEvent, ChangeEvent, KeyboardEvent, MouseEvent, DragEvent, ComponentProps, RefObject } from "@/shared/ui-types";
import { ExportDialog } from "./export-dialog";
const effects=createEffects();
type ViewProps = {
    kind: RecordKind;
    onClose: () => void;
};
export let kind: ViewProps["kind"] = undefined as any;
export let onClose: ViewProps["onClose"] = undefined as any;
const workspaceStore=useWorkspace();
let { refresh, workspace } = $workspaceStore;
$: ({ refresh, workspace } = $workspaceStore);
let rows: RecordData[] = initialState<RecordData[]>([]);
const setRows = (next: RecordData[] | ((current: RecordData[]) => RecordData[])) => { rows = typeof next === "function" ? (next as (current: RecordData[]) => RecordData[])(rows) : next; };
let error: string = "";
const setError = (next: typeof error | ((current: typeof error) => typeof error)) => { error = typeof next === "function" ? (next as (current: typeof error) => typeof error)(error) : next; };
let busy: boolean = false;
const setBusy = (next: typeof busy | ((current: typeof busy) => typeof busy)) => { busy = typeof next === "function" ? (next as (current: typeof busy) => typeof busy)(busy) : next; };
let result: {
    imported: number;
    errors: {
        row: number;
        error: string;
    }[];
} | null = null;
const setResult = (next: {
    imported: number;
    errors: {
        row: number;
        error: string;
    }[];
} | null | ((current: {
    imported: number;
    errors: {
        row: number;
        error: string;
    }[];
} | null) => {
    imported: number;
    errors: {
        row: number;
        error: string;
    }[];
} | null)) => { result = typeof next === "function" ? (next as (current: {
    imported: number;
    errors: {
        row: number;
        error: string;
    }[];
} | null) => {
    imported: number;
    errors: {
        row: number;
        error: string;
    }[];
} | null)(result) : next; };
let parse = (file: File) => {
    setError("");
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: "greedy",
        complete(parsed) {
            if (parsed.errors.length) {
                setError(`CSV-Zeile ${(parsed.errors[0].row || 0) + 2}: ${parsed.errors[0].message}`);
                setRows([]);
                return;
            }
            if (parsed.data.length > 200) {
                setError("Bitte höchstens 200 Zeilen je Import verwenden.");
                setRows([]);
                return;
            }
            setRows(parsed.data.map((row) => Object.fromEntries(Object.entries(row)
                .filter(([, val]) => val !== "")
                .map(([key, val]) => [
                key,
                /^(quantity|minQuantity|durationSeconds|pauseSeconds|durationMinutes|version)$/.test(key)
                    ? Number(val)
                    : /^(alternate|read)$/.test(key)
                        ? val === "true"
                        : /^[\[{]/.test(val)
                            ? (() => {
                                try {
                                    return JSON.parse(val);
                                }
                                catch {
                                    return val;
                                }
                            })()
                            : val,
            ]))));
        },
        error(e) {
            setError(e.message);
        },
    });
};
let template = () => {
    const columns = (fields[kind] || []).map((field) => field.key);
    const url = URL.createObjectURL(new Blob(["\uFEFF" + Papa.unparse([columns]) + "\r\n"], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `digitalmask-${kind}-importvorlage.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
let submit = async () => {
    setBusy(true);
    setError("");
    try {
        const next = await post<{
            imported: number;
            errors: {
                row: number;
                error: string;
            }[];
        }>("/api/import", { kind, rows });
        setResult(next);
        setRows(next.errors.map((item) => rows[item.row - 1]).filter(Boolean));
        if (next.imported)
            await refresh();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Import fehlgeschlagen");
    }
    finally {
        setBusy(false);
    }
};





</script>

<Modal title={`${labels[kind][0]} importieren`} onClose={onClose} wide>
      <p class="muted">
        Verwende die Importvorlage mit technischen Feldnamen in der ersten Zeile. Ein Import legt
        neue Einträge an. Druck- und Berichtsexporte verwenden andere Spalten und sind keine
        Importvorlage.
      </p>
      <Button onClick={template}>
        <Download size={16}></Download>
        CSV-Importvorlage herunterladen
      </Button>
      <details class="history-version">
        <summary>Felder, Formate & Zuordnungen</summary>
        <p class="small muted">
          Datum: JJJJ-MM-TT. Zeitpunkte: ISO mit Zeitzone. Dauer und Pause: Sekunden. Mehrfachwerte
          und Checklisten: JSON-Arrays. Zuordnungen verwenden die ID des Eintrags.
        </p>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>CSV-Spalte</th>
                <th>Bedeutung</th>
              </tr>
            </thead>
            <tbody>
              {#each (fields[kind] || []) as field (field.key)}<tr>
                  <td>{field.key}</td>
                  <td>
                    {field.key === "durationSeconds"
    ? "Arbeitsdauer in Sekunden"
    : field.key === "pauseSeconds"
        ? "Pause in Sekunden"
        : field.label}
                    {field.required ? " · Pflichtfeld" : ""}
                  </td>
                </tr>{/each}
            </tbody>
          </table>
        </div>
        {#each (fields[kind] || [])
    .filter((field) => field.source) as field (field.key)}<details class="history-version">
              <summary>IDs für {field.label}</summary>
              {#if field.source === "members"}{#each workspace.members.filter(isActiveStaff) as member (member.id)}<p class="small">
                      {member.name} · <code>{member.id}</code>
                    </p>{/each}{:else}{#each workspace.records[field.source!] as record (record.id)}<p class="small">
                      {String(record.data.title || record.data.name)} · <code>{record.id}</code>
                    </p>{/each}{/if}
            </details>{/each}
      </details>
      <label class="file-drop">
        <Upload size={22}></Upload>
        CSV-Datei auswählen
        <input type="file" accept=".csv,text/csv" disabled={busy} on:input={(event) => {
    const file = event.currentTarget.files?.[0];
    if (file)
        parse(file);
}} />
      </label>
      {#if result}<section class={result.errors.length ? "error-message" : "success-message"} role="status">
          <div>
            <strong>{result.imported} Einträge importiert.</strong>
            {#if result.errors.length > 0}
                <p>
                  {result.errors.length} Zeilen konnten nicht übernommen werden. Erfolgreiche
                  Einträge werden bei einem erneuten Versuch nicht wieder importiert.
                </p>
                <ul>
                  {#each result.errors as item (item.row)}<li>
                      Datenzeile {item.row}: {item.error}
                    </li>{/each}
                </ul>
                <p>
                  Du kannst die verbleibenden Zeilen erneut versuchen oder eine korrigierte
                  CSV-Datei mit ausschließlich diesen Zeilen auswählen.
                </p>
              {/if}
          </div>
        </section>{/if}
      {#if rows.length > 0}
          <p class="small">
            {rows.length} {result ? "verbleibende" : "gefundene"} Datensätze · Vorschau der ersten 5
          </p>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  {#each Object.keys(rows[0]) as key (key)}<th>{key}</th>{/each}
                </tr>
              </thead>
              <tbody>
                {#each rows.slice(0, 5) as row, i (i)}<tr>
                    {#each Object.keys(rows[0]) as key (key)}<td>
                        {typeof row[key] === "object"
    ? JSON.stringify(row[key])
    : String(row[key] ?? "")}
                      </td>{/each}
                  </tr>{/each}
              </tbody>
            </table>
          </div>
        {/if}
      <ErrorMessage message={error}></ErrorMessage>
      <footer class="dialog-footer">
        <Button onClick={onClose}>{result ? "Schließen" : "Abbrechen"}</Button>
        <Button variant="primary" disabled={!rows.length || busy} onClick={() => void submit()}>
          {busy ? "Wird importiert …" : `${rows.length} Einträge importieren`}
        </Button>
      </footer>
    </Modal>
