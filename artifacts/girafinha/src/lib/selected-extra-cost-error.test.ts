import assert from "node:assert/strict";
import test from "node:test";
import { selectedExtraCostErrorMessage } from "./selected-extra-cost-error.ts";

test("401 is treated as expired session", () => {
  assert.deepEqual(selectedExtraCostErrorMessage({ status: 401 }), {
    title: "Sessão expirada",
    description: "Volta a iniciar sessão e tenta guardar novamente.",
  });
});

test("404 is treated as missing occurrence", () => {
  assert.deepEqual(selectedExtraCostErrorMessage({ response: { status: 404 } }), {
    title: "Extra não encontrado",
    description: "Atualiza os Relatórios e tenta novamente.",
  });
});

test("400 does not expose raw API details", () => {
  const message = selectedExtraCostErrorMessage({
    status: 400,
    data: { error: "database detail that must not leak" },
  });
  assert.equal(message.title, "Custo inválido");
  assert.equal(message.description.includes("database"), false);
});

test("5xx receives a safe server error", () => {
  assert.equal(selectedExtraCostErrorMessage({ status: 500 }).title, "Erro do servidor");
});
