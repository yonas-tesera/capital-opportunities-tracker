import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROLES } from "@/domain/enums";
import { can, PERMISSIONS, type Permission } from "@/domain/rbac";
import { ERRORS } from "@/domain/result";

// Keeps docs/server-actions.md honest: it must describe every action in src/actions, no more and no less.

const root = process.cwd();
const doc = readFileSync(path.join(root, "docs/server-actions.md"), "utf8");
const actionsDir = path.join(root, "src/actions");

interface ActionInfo {
  name: string;
  file: string;
  permission: string;
}

const actions: ActionInfo[] = readdirSync(actionsDir)
  .filter((file) => file.endsWith(".ts"))
  .flatMap((file) => {
    const source = readFileSync(path.join(actionsDir, file), "utf8");
    return source
      .split(/^export async function /m)
      .slice(1)
      .map((chunk) => ({
        name: /^(\w+)/.exec(chunk)?.[1] ?? "",
        file,
        permission: /requirePermission\("(\w+)"\)/.exec(chunk)?.[1] ?? "",
      }));
  });

function section(name: string): string {
  const start = doc.indexOf(`### \`${name}\``);
  if (start === -1) return "";
  const rest = doc.slice(start + 4);
  const end = rest.search(/^(###? |---)/m);
  return end === -1 ? rest : rest.slice(0, end);
}

describe("docs/server-actions.md", () => {
  it("found the actions to check", () => {
    expect(actions.length).toBeGreaterThanOrEqual(11);
    expect(actions.every((a) => a.name && a.permission)).toBe(true);
  });

  it.each(actions)("documents $name with all required parts", ({ name, permission, file }) => {
    const text = section(name);
    expect(text, `missing "### \`${name}\`" section`).not.toBe("");
    for (const label of ["**Purpose.**", "**Who can call it.**", "**Inputs.**", "**Success output.**", "**Failures.**"]) {
      expect(text, `${name} lacks ${label}`).toContain(label);
    }
    expect(text, `${name} should cite permission ${permission}`).toContain(`(\`${permission}\`)`);
    expect(doc, `${name} row in the summary table`).toMatch(
      new RegExp(`\\| \\[\`${name}\`\\]\\(#[a-z]+\\) \\| \`src/actions/${file}\` \\| \`${permission}\` \\|`),
    );
  });

  it("documents no action that does not exist", () => {
    const documented = [...doc.matchAll(/^### `(\w+)`/gm)].map((m) => m[1]);
    expect(documented.sort()).toEqual(actions.map((a) => a.name).sort());
  });

  it("lists every error message verbatim", () => {
    for (const [kind, message] of Object.entries(ERRORS)) {
      expect(doc, `${kind} message`).toContain(message);
    }
  });

  it("only names known error kinds in Failures lines", () => {
    const failureLines = doc.split("\n").filter((line) => line.startsWith("**Failures.**"));
    for (const line of failureLines) {
      for (const [, kind] of line.matchAll(/`([A-Z_]+)`/g)) {
        expect(Object.keys(ERRORS), `unknown error kind ${kind}`).toContain(kind);
      }
    }
  });

  it("matches the RBAC permission matrix", () => {
    for (const permission of Object.keys(PERMISSIONS) as Permission[]) {
      const row = new RegExp(`^\\| \`${permission}\` \\|(.*)\\|$`, "m").exec(doc)?.[1];
      expect(row, `matrix row for ${permission}`).toBeDefined();
      const cells = (row ?? "").split("|").map((cell) => cell.trim());
      ROLES.forEach((role, index) => {
        expect(cells[index] === "yes", `${permission} for ${role}`).toBe(can(role, permission));
      });
    }
  });
});
